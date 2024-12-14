import { AgGridReact } from "ag-grid-react";
import { useMemo, useState, useEffect } from "react";
import { CellClassParams, ColDef, NewValueParams, themeBalham, ValueFormatterParams } from "ag-grid-community";
import { DashboardData, DashboardRow, AccountData } from "../types/DashboardData";

console.log("Rendering AGTable component");

let renderCount = 0;

const myTheme = themeBalham.withParams({
    wrapperBorder: false,
    headerRowBorder: false,
    // rowBorder: { width: 1, color: '#9696C8' },
    columnBorder: { color: '#f0f0f0' },
});

function currencyFormatter(value: string, currency = "$") {
    if (!value || value === "" || value === "0") {
        return "";
    }
    const num = parseFloat(value);
    return isNaN(num) ? "" : (num < 0 ? "-" + currency + Math.abs(num).toFixed(2) : currency + num.toFixed(2));
}

function evaluateFormula(formula: string) {
    try {
        const result = eval(formula.slice(1));
        return isNaN(result) ? 0 : result;
    } catch (error) {
        console.warn('Formula evaluation error:', error);
        return 0;
    }
}

function parseValue(value: string) {
    if (!value || value === "") return 0;

    if (typeof value === 'string' && value.startsWith('=')) {
        return evaluateFormula(value);
    }

    const num = parseFloat(value);
    return isNaN(num) ? 0 : num;
}

function formulaFormatter(value: string) {
    if (!value || value === "") return "";
    return currencyFormatter(parseValue(value));
}

function AGTable({ dashboardData }: { dashboardData: DashboardData }) {
    console.log(`AGTable render count: ${++renderCount}`);
    console.time('AGTable render');

    useEffect(() => {
        console.timeEnd('AGTable render');
        return () => console.log('AGTable unmounting');
    });

    // Add this helper function inside AGTable component
    const recalculateBalances = (rowData: DashboardRow[], account: string, startIndex: number) => {
        console.log("recalculateBalances called", { account, startIndex });
        console.time('recalculateBalances');
        const newRowData = [...rowData];
        const prevAccountData = newRowData[startIndex - 1][account] as AccountData;
        let prevBalance = startIndex > 0 ? parseValue(prevAccountData.balance) : 0;
        let prevTransaction = startIndex > 0 ? parseValue(prevAccountData.transaction || '0') : 0;

        for (let i = startIndex; i < newRowData.length; i++) {
            // Calculate new balance based on previous balance and previous transaction
            const accountData = newRowData[i][account] as AccountData;
            accountData.balance = (prevBalance + prevTransaction).toFixed(2);

            // Update previous values for next iteration
            prevBalance = parseValue(accountData.balance);
            prevTransaction = parseValue(accountData.transaction || '0');
        }
        console.timeEnd('recalculateBalances');
        return newRowData;
    };

    // Initialize rowData with user transactions applied
    const [rowData, setRowData] = useState(() => {
        console.log("Initializing rowData");
        console.time('rowData initialization');
        const updatedRows = [...dashboardData.rows];

        if (dashboardData.user_transactions) {
            dashboardData.user_transactions.forEach(transaction => {
                const { date, account, transaction: transactionValue, description } = transaction;
                const rowIndex = updatedRows.findIndex(row => row.date === date);

                if (rowIndex !== -1) {
                    // Update both transaction and description if they exist
                    const accountData = updatedRows[rowIndex][account] as AccountData;
                    if (transactionValue) {
                        accountData.transaction = transactionValue;
                    }
                    if (description) {
                        accountData.description = description;
                    }

                    // Only recalculate balances if there was a transaction value
                    if (transactionValue) {
                        return recalculateBalances(updatedRows, account, rowIndex);
                    }
                }
            });
        }
        console.timeEnd('rowData initialization');
        return updatedRows;
    });

    // Initialize userEdits with data from dashboardData.user_transactions
    const [userEdits, setUserEdits] = useState(() => {
        console.log("Initializing userEdits");
        console.time('userEdits initialization');
        const editsMap = new Map();

        // If user_transactions exists, populate the userEdits map
        if (dashboardData.user_transactions) {
            dashboardData.user_transactions.forEach(transaction => {
                const { date, account, transaction: transactionValue, description } = transaction;

                // Create nested maps following existing structure
                if (!editsMap.has(date)) {
                    editsMap.set(date, new Map());
                }
                if (!editsMap.get(date).has(account)) {
                    editsMap.get(date).set(account, new Map());
                }

                // Add transaction and description if they exist
                const accountEdits = editsMap.get(date).get(account);
                if (transactionValue) {
                    accountEdits.set('transaction', {
                        value: transactionValue,
                        timestamp: new Date().toISOString()
                    });
                }
                if (description) {
                    accountEdits.set('description', {
                        value: description,
                        timestamp: new Date().toISOString()
                    });
                }
            });
        }
        console.timeEnd('userEdits initialization');
        return editsMap;
    });

    // Validate data integrity
    useMemo(() => {
        console.log("Running data integrity validation");
        console.time('data validation');
        if (!dashboardData.rows || dashboardData.rows.length === 0) return;

        // For each account
        dashboardData.accounts.forEach((account) => {
            // Track running balance
            let prevTransaction = 0;
            let prevBalance = 0;

            // Check each day's balance
            dashboardData.rows.forEach((row, index) => {
                const accountData = row[account] as AccountData;
                const balance = parseFloat(accountData.balance);
                const currentTransaction = parseFloat(accountData.transaction || '0');

                // Skip validation for first row since we don't have previous balance
                if (index === 0) {
                    prevTransaction = currentTransaction;
                    prevBalance = balance;
                    return;
                }

                // Calculate expected balance
                const expectedBalance = prevBalance + prevTransaction;

                // Compare with actual balance (using small epsilon for float comparison)
                if (Math.abs(expectedBalance - balance) > 0.01) {
                    console.warn(
                        `Data integrity warning for ${account} on ${row.date}:`,
                        `Previous balance: ${prevBalance}`,
                        `Previous transaction: ${prevTransaction}`,
                        `Transaction: ${currentTransaction}`,
                        `Expected balance: ${expectedBalance}`,
                        `Actual balance: ${balance}`
                    );
                }

                prevTransaction = currentTransaction;
                prevBalance = balance;
            });
        });
        console.timeEnd('data validation');
    }, [dashboardData]);

    // Update the userEdits tracking structure
    const handleEditUpdate = (date: string, account: string, field: string, value: string, format?: { bold?: boolean, italic?: boolean }) => {
        console.log("handleEditUpdate called", { date, account, field, value });
        setUserEdits(prev => {
            const newEdits = new Map(prev);
            if (!newEdits.has(date)) {
                newEdits.set(date, new Map());
            }
            const accountEdits = newEdits.get(date);
            if (!accountEdits.has(account)) {
                accountEdits.set(account, new Map());
            }
            accountEdits.get(account).set(field, {
                value,
                timestamp: new Date().toISOString()
            });
            if (format) {
                accountEdits.get(account).set('format', {
                    [field]: format
                });
            }
            return newEdits;
        });
        // send an async request to save the transaction
        fetch(`http://127.0.0.1:5000/mars-universe-bank/extension/MarsDashboard/save_user_transaction`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                date,
                account,
                [field]: value,
                format: format ? { [field]: format } : undefined
            }),
        });
    };

    // Helper to check if a cell was edited by user
    const isUserEdited = (date: string | undefined, account: string, field: string) => {
        if (!date) return false;
        return userEdits.has(date) &&
            userEdits.get(date).has(account) &&
            userEdits.get(date).get(account).has(field);
    };

    // Cell renderer for formatted cells
    // const FormattedCellRenderer = (params: any) => {
    //     const date = params.data?.date;
    //     const account = params.column.colDef.field?.split('.')[0];
    //     const field = params.column.colDef.cellEditorParams?.field;

    //     // Get formatting if it exists
    //     let format;
    //     if (date && userEdits.has(date) && 
    //         userEdits.get(date)?.has(account) && 
    //         userEdits.get(date)?.get(account)?.has('format')) {
    //         format = userEdits.get(date)?.get(account)?.get('format')?.[field];
    //     }

    //     const style: React.CSSProperties = {
    //         textAlign: field === 'transaction' ? 'right' : 'left',
    //         color: isPastDate(date) ? "#D1D5DB" : 
    //               isUserEdited(date, account, field) ? "blue" : "inherit",
    //         fontWeight: format?.bold ? 'bold' : 'normal',
    //         fontStyle: format?.italic ? 'italic' : 'normal'
    //     };

    //     const value = field === 'transaction' ? 
    //         formulaFormatter(params.value) : params.value;

    //     return <span style={style}>{value}</span>;
    // };

    // Column definitions
    const columnDefs = useMemo<ColDef<DashboardRow, any>[]>(() => {
        console.log("Recalculating columnDefs");
        console.time('columnDefs calculation');
        const columns: ColDef<DashboardRow, any>[] = [
            {
                field: "date",
                headerName: "Date",
                headerClass: "bg-black text-white",
                pinned: "left" as const,
                width: 90,
                valueFormatter: (params: ValueFormatterParams<DashboardRow>) => {
                    const date = new Date(params.value);
                    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
                    return `${days[date.getDay()]} ${(date.getMonth() + 1)}/${date.getDate()}`;
                },
                cellStyle: (params: CellClassParams<DashboardRow>) => {
                    const today = new Date().toISOString().split("T")[0];
                    const isToday = params.value === today;
                    const isPast = params.value < today;
                    const isWeekend = [0, 6].includes(new Date(params.value).getDay());

                    return {
                        textAlign: "right",
                        fontWeight: isToday ? "bold" : "normal",
                        textDecoration: isToday ? "underline" : "none",
                        color: isPast ? "#D1D5DB" : (isWeekend ? "#777" : "#"),
                        fontStyle: isPast || isWeekend ? "italic" : "normal",
                    };
                },
            },
        ];

        // Add columns for each account only if they have data
        dashboardData.accounts.forEach((account) => {
            // Check if account has any transactions or non-zero balances
            const hasData = dashboardData.rows.some((row) => {
                const accountData = row[account] as AccountData;
                return accountData.transaction || (accountData.balance && parseFloat(accountData.balance) !== 0);
            });

            // Only add columns if the account has data
            if (hasData) {
                const accountShort = account.replace("Assets:Saving:", "").replace("Assets:Checking:", "");
                const accountClass = account
                    .replace("Assets:Checking:", "")
                    .replace("Assets:Saving:", "")
                    .replace(":", "-")
                    .toLowerCase();

                columns.push(
                    {
                        headerName: accountShort,
                        field: `${account}.balance`,
                        headerClass: `header-bank-${accountClass}`,
                        width: 80,
                        valueFormatter: (params: { value: string }) => currencyFormatter(params.value),
                        cellStyle: (params: CellClassParams<DashboardRow>) => ({
                            textAlign: "right",
                            color: isPastDate(params.data?.date) ? "#D1D5DB" :
                                parseFloat(params.value) < 0 ? "red" : "inherit",
                        }),
                    },
                    {
                        headerName: "Transaction",
                        field: `${account}.transaction`,
                        editable: true,
                        headerClass: `header-bank-${accountClass}`,
                        width: 80,
                        valueFormatter: (params: ValueFormatterParams<DashboardRow>) => formulaFormatter(params.value),
                        cellStyle: (params: CellClassParams<DashboardRow>) => ({
                            textAlign: "right",
                            color: isPastDate(params.data?.date) ? "#D1D5DB" :
                                isUserEdited(params.data?.date, account, 'transaction') ? "blue" : "inherit",
                        }),
                        onCellValueChanged: (event: NewValueParams<DashboardRow, string>) => {
                            const field = event.column.getColDef().field;
                            const account = field?.split(".")[0] ?? "";
                            const rowIndex = rowData.findIndex((row) => row.date === event.data.date);

                            if (rowIndex === -1) {
                                console.warn('Row not found for edit');
                                return;
                            }

                            handleEditUpdate(
                                event.data.date,
                                account,
                                'transaction',
                                event.newValue || ""
                            );

                            const updatedRowData = [...rowData];
                            const accountData = updatedRowData[rowIndex][account] as AccountData;
                            accountData.transaction = event.newValue || "";
                            const finalRowData = recalculateBalances(updatedRowData, account, rowIndex);
                            setRowData(finalRowData);
                        },
                    },
                    {
                        headerName: "Notes",
                        field: `${account}.description`,
                        editable: true,
                        headerClass: `header-bank-${accountClass}`,
                        width: 120,
                        cellStyle: (params: CellClassParams<DashboardRow, string>) => ({
                            textAlign: "left",
                            color: isPastDate(params.data?.date) ? "#D1D5DB" :
                                isUserEdited(params.data?.date, account, 'description') ? "blue" : "inherit",
                        }),
                        onCellValueChanged: (event: NewValueParams<DashboardRow, string>) => {
                            handleEditUpdate(
                                event.data.date,
                                account,
                                'description',
                                event.newValue || ""
                            );
                        },
                    }
                );
            }
        });
        console.timeEnd('columnDefs calculation');
        return columns;
    }, [dashboardData.accounts, dashboardData.rows, userEdits]);

    const isPastDate = (date: string | undefined) => {
        if (!date) return false;
        const today = new Date().toISOString().split("T")[0];
        return date < today;
    };

    // Debug memo to track edits (optional)
    useMemo(() => {
        if (userEdits.size > 0) {
            console.log('User Edits Structure:', Object.fromEntries(userEdits));
        }
    }, [userEdits]);

    return (
        <div className="ag-theme-alpine" style={{ height: "calc(100vh - 52px)", width: "100%", overflow: "hidden" }}>
            <AgGridReact
                columnDefs={columnDefs}
                rowData={rowData}
                theme={myTheme}
                defaultColDef={{
                    sortable: false,
                    filter: false,
                    resizable: true,
                }}
                suppressScrollOnNewData={true}
                animateRows={false}
            />
        </div>
    );
}

export default AGTable;
