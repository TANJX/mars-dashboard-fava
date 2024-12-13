import { AgGridReact } from "ag-grid-react";
import { useMemo, useState, useEffect } from "react";
import { themeBalham } from "ag-grid-community";

console.log("Rendering AGTable component");

let renderCount = 0;

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

export interface AccountData {
    balance: string;
    transaction?: string;
    description?: string;
}

export interface DashboardRow {
    date: string;
    [accountKey: string]: AccountData | string; // allows for dynamic account names
}

export interface UserTransaction {
    date: string;
    account: string;
    transaction?: string;
    description?: string;
}

export interface DashboardData {
    rows: DashboardRow[];
    accounts: string[];
    user_transactions?: UserTransaction[];
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
        console.log("recalculateBalances called", {account, startIndex});
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
                const balance = parseFloat(row[account].balance);
                const currentTransaction = parseFloat(row[account].transaction || 0);

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
    const handleEditUpdate = (date: string, account: string, field: string, value: string) => {
        console.log("handleEditUpdate called", {date, account, field, value});
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
            return newEdits;
        });
        // send an async request to save the transaction
        fetch(`http://127.0.0.1:5000/mars-universe-bank/extension/MarsDashboard/save_user_transaction`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ date, account, transaction: field === "transaction" ? value || "" : undefined, description: field === "description" ? value || "" : undefined }),
        });
    };

    // Helper to check if a cell was edited by user
    const isUserEdited = (date: string, account: string, field: string) => {
        return userEdits.has(date) && 
               userEdits.get(date).has(account) && 
               userEdits.get(date).get(account).has(field);
    };

    // Column definitions
    const columnDefs = useMemo(() => {
        console.log("Recalculating columnDefs");
        console.time('columnDefs calculation');
        const columns = [
            {
                field: "date",
                headerName: "Date",
                headerClass: "bg-black text-white",
                pinned: "left",
                width: 120,
                cellStyle: (params) => {
                    const today = new Date().toISOString().split("T")[0];
                    const isToday = params.value === today;
                    const isPast = params.value < today;

                    return {
                        fontWeight: isToday ? "bold" : "normal",
                        textDecoration: isToday ? "underline" : "none",
                        color: isPast ? "#D1D5DB" : "inherit",
                        fontStyle: isPast ? "italic" : "normal",
                    };
                },
            },
        ];

        // Add columns for each account only if they have data
        dashboardData.accounts.forEach((account) => {
            // Check if account has any transactions or non-zero balances
            const hasData = dashboardData.rows.some((row) => {
                const accountData = row[account];
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
                        cellStyle: (params) => ({
                            textAlign: "right",
                            color: isPastDate(params.data.date) ? "#D1D5DB" : 
                                  parseFloat(params.value) < 0 ? "red" : "inherit",
                        }),
                    },
                    {
                        headerName: "Transaction",
                        field: `${account}.transaction`,
                        editable: true,
                        headerClass: `header-bank-${accountClass}`,
                        width: 80,
                        valueFormatter: (params) => formulaFormatter(params.value),
                        cellStyle: (params) => ({
                            textAlign: "right",
                            color: isPastDate(params.data.date) ? "#D1D5DB" : 
                                  isUserEdited(params.data.date, account, 'transaction') ? "blue" : "inherit",
                        }),
                        onCellValueChanged: (event) => {
                            const account = event.column.colDef.field.split(".")[0];
                            const rowIndex = rowData.findIndex((row) => row.date === event.data.date);
                            
                            if (rowIndex === -1) {
                                console.log(rowData);
                                console.warn('Row not found for edit');
                                return;
                            }

                            handleEditUpdate(
                                event.data.date,
                                account,
                                'transaction',
                                event.newValue
                            );

                            const updatedRowData = [...rowData];
                            updatedRowData[rowIndex][account].transaction = event.newValue;
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
                        cellStyle: (params) => ({
                            textAlign: "left",
                            color: isPastDate(params.data.date) ? "#D1D5DB" : 
                                  isUserEdited(params.data.date, account, 'description') ? "blue" : "inherit",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                        }),
                        onCellValueChanged: (event) => {
                            handleEditUpdate(
                                event.data.date,
                                account,
                                'description',
                                event.newValue
                            );
                        },
                    }
                );
            }
        });
        console.timeEnd('columnDefs calculation');
        return columns;
    }, [dashboardData.accounts, dashboardData.rows, userEdits]);

    const isPastDate = (date: string) => {
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
        <div className="ag-theme-alpine" style={{ height: "100vh", width: "100%" }}>
            <AgGridReact
                columnDefs={columnDefs}
                rowData={rowData}
                theme={themeBalham}
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
