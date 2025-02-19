import { AgGridReact } from "ag-grid-react";
import { useMemo, useState, useEffect, useRef } from "react";
import { CellClassParams, CellClickedEvent, ColDef, NewValueParams, themeBalham, ValueFormatterParams } from "ag-grid-community";
import { DashboardData, DashboardRow, AccountData, UserTransaction } from "../types/DashboardData";
import { parseValue, currencyFormatter, formulaFormatter, isPastDate } from '../utils/data';
import CellFormatMenu from './CellFormatMenu';

const myTheme = themeBalham.withParams({
    wrapperBorder: false,
    headerRowBorder: false,
    // rowBorder: { width: 1, color: '#9696C8' },
    columnBorder: { color: '#f0f0f0' },
});

interface MenuPosition {
    x: number;
    y: number;
}

interface ActiveCell {
    date: string;
    account: string;
    field: "transaction" | "description";
}

function AGTable({ dashboardData }: { dashboardData: DashboardData }) {
    useEffect(() => {
        return () => console.log('AGTable unmounting');
    });

    const gridRef = useRef<HTMLDivElement>(null);

    // Add this helper function inside AGTable component
    const recalculateBalances = (rowData: DashboardRow[], account: string, startIndex: number) => {
        const newRowData = [...rowData];
        let prevBalance;
        let prevTransaction;
        if (startIndex > 0) {
            const prevAccountData = newRowData[startIndex - 1][account] as AccountData;
            prevBalance = startIndex > 0 ? parseValue(prevAccountData.balance) : 0;
            prevTransaction = startIndex > 0 ? parseValue(prevAccountData.transaction || '0') : 0;
        } else {
            prevBalance = parseValue((rowData[startIndex][account] as AccountData).balance);
            prevTransaction = 0;
        }

        for (let i = startIndex; i < newRowData.length; i++) {
            // Calculate new balance based on previous balance and previous transaction
            const accountData = newRowData[i][account] as AccountData;
            accountData.balance = (prevBalance + prevTransaction).toFixed(2);

            // Update previous values for next iteration
            prevBalance = parseValue(accountData.balance);
            prevTransaction = parseValue(accountData.transaction || '0');
        }
        return newRowData;
    };

    // Initialize rowData with user transactions applied
    const [rowData, setRowData] = useState(() => {
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
        return updatedRows;
    });

    // Initialize userEdits with data from dashboardData.user_transactions
    const [userEdits, setUserEdits] = useState<UserTransaction[]>(() => {
        const userTransactions = JSON.parse(JSON.stringify(dashboardData.user_transactions));
        return userTransactions;
    });

    // Validate data integrity
    useMemo(() => {
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
    }, [dashboardData]);

    // Update the userEdits tracking structure
    const handleEditUpdate = (date: string, account: string, field: "transaction" | "description", value: string) => {
        console.log("handleEditUpdate called", { date, account, field, value });
        const newUserEdit: UserTransaction = {
            date,
            account,
            [field]: value,
        };
        setUserEdits(prev => {
            const newEdits = [...prev];
            newEdits.push(newUserEdit);
            return newEdits;
        });
        // send an async request to save the transaction
        fetch(`http://127.0.0.1:5000/mars-universe-bank/extension/MarsDashboard/save_user_transaction`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newUserEdit),
        });
    };

    const handleFormatUpdate = (date: string, account: string, field: "transaction" | "description", bold?: boolean, italic?: boolean) => {
        console.log("handleFormatUpdate called", { date, account, field, bold, italic });
        const newUserEdit: UserTransaction = {
            date,
            account,
            format: {
                [field]: {
                    bold,
                    italic
                }
            }
        };
        setUserEdits(prev => {
            const newEdits = [...prev];
            newEdits.push(newUserEdit);
            return newEdits;
        });
        // send an async request to save the format
        fetch(`http://127.0.0.1:5000/mars-universe-bank/extension/MarsDashboard/save_user_transaction`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newUserEdit),
        });
    };

    // Helper to check if a cell was edited by user
    const isUserEdited = (date: string | undefined, account: string, field: "transaction" | "description") => {
        if (!date) return false;
        return userEdits.some(transaction => transaction.date === date && transaction.account === account && transaction[field]);
    };

    const isUserEditedFormat = (date: string | undefined, account: string, field: "transaction" | "description", format: "bold" | "italic") => {
        if (!date) return false;
        // find the last transaction for this account and field
        for (let i = userEdits.length - 1; i >= 0; i--) {
            const transaction = userEdits[i];
            if (transaction.date === date && transaction.account === account && transaction.format?.[field]?.[format] !== undefined) {
                return transaction.format[field][format];
            }
        }
        return false;
    };

    const [menuPosition, setMenuPosition] = useState<MenuPosition | null>(null);
    const [activeCell, setActiveCell] = useState<ActiveCell | null>(null);

    const handleCellClick = (event: CellClickedEvent) => {
        if (!gridRef.current) return;

        const field = event.column.getColDef().field;
        if (!field || !event.data?.date) return;

        const [account, fieldType] = field.split('.');
        if (fieldType !== 'transaction' && fieldType !== 'description') return;

        // Get cell element position
        const cellElement = event.event?.target as HTMLElement;
        if (!cellElement) return;

        const rect = cellElement.getBoundingClientRect();
        const gridRect = gridRef.current.getBoundingClientRect();
        
        setMenuPosition({
            x: rect.right - gridRect.left,
            y: rect.top + (rect.height / 2) - gridRect.top
        });
        
        setActiveCell({
            date: event.data.date,
            account,
            field: fieldType
        });
    };

    const closeMenu = () => {
        setMenuPosition(null);
        setActiveCell(null);
    };

    // Column definitions
    const columnDefs = useMemo<ColDef<DashboardRow, any>[]>(() => {
        const columns: ColDef<DashboardRow, any>[] = [
            {
                field: "date",
                headerName: "Date",
                headerClass: "bg-black text-white",
                pinned: "left" as const,
                width: 90,
                valueFormatter: (params: ValueFormatterParams<DashboardRow>) => {
                    const date = new Date(params.value + 'T00:00');
                    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
                    return `${days[date.getDay()]} ${(date.getMonth() + 1)}/${date.getDate()}`;
                },
                cellStyle: (params: CellClassParams<DashboardRow>) => {
                    const today = new Date().toISOString().split("T")[0];
                    const isToday = params.value === today;
                    const isPast = params.value < today;
                    const isWeekend = [0, 6].includes(new Date(params.value + 'T00:00').getDay());

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
                        width: 90,
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
                        width: 150,
                        valueFormatter: (params: ValueFormatterParams<DashboardRow>) => formulaFormatter(params.value),
                        cellStyle: (params: CellClassParams<DashboardRow>) => ({
                            textAlign: "right",
                            color: isUserEdited(params.data?.date, account, 'transaction') ? "blue" :
                                isPastDate(params.data?.date) ? "#D1D5DB" : "inherit",
                            fontWeight: isUserEditedFormat(params.data?.date, account, 'transaction', 'bold') ? "bold" : "normal",
                            fontStyle: isUserEditedFormat(params.data?.date, account, 'transaction', 'italic') ? "italic" : "normal",
                        }),
                        onCellClicked: (event: CellClickedEvent) => {
                            handleCellClick(event);
                        },
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
                        width: 150,
                        cellStyle: (params: CellClassParams<DashboardRow, string>) => ({
                            textAlign: "left",
                            color: isUserEdited(params.data?.date, account, 'description') ? "blue" :
                                isPastDate(params.data?.date) ? "#D1D5DB" : "inherit",
                            fontWeight: isUserEditedFormat(params.data?.date, account, 'description', 'bold') ? "bold" : "normal",
                            fontStyle: isUserEditedFormat(params.data?.date, account, 'description', 'italic') ? "italic" : "normal",
                        }),
                        onCellClicked: (event: CellClickedEvent) => {
                            handleCellClick(event);
                        },
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
        return columns;
    }, [dashboardData.accounts, dashboardData.rows, userEdits]);


    // Debug memo to track edits (optional)
    // useMemo(() => {
    //     if (userEdits.length > 0) {
    //         console.log('User Edits Structure:', userEdits);
    //     }
    // }, [userEdits]);

    return (
        <div className="ag-theme-alpine relative" style={{ height: "calc(100vh - 52px)", width: "100%", overflow: "hidden" }} ref={gridRef}>
            <CellFormatMenu
                position={menuPosition}
                isVisible={!!menuPosition && !!activeCell}
                onClose={closeMenu}
                isBold={activeCell ? isUserEditedFormat(activeCell.date, activeCell.account, activeCell.field, 'bold') : false}
                isItalic={activeCell ? isUserEditedFormat(activeCell.date, activeCell.account, activeCell.field, 'italic') : false}
                onToggleBold={() => {
                    if (activeCell) {
                        const currentState = isUserEditedFormat(activeCell.date, activeCell.account, activeCell.field, 'bold');
                        handleFormatUpdate(
                            activeCell.date,
                            activeCell.account,
                            activeCell.field,
                            !currentState,
                            isUserEditedFormat(activeCell.date, activeCell.account, activeCell.field, 'italic')
                        );
                    }
                }}
                onToggleItalic={() => {
                    if (activeCell) {
                        const currentState = isUserEditedFormat(activeCell.date, activeCell.account, activeCell.field, 'italic');
                        handleFormatUpdate(
                            activeCell.date,
                            activeCell.account,
                            activeCell.field,
                            isUserEditedFormat(activeCell.date, activeCell.account, activeCell.field, 'bold'),
                            !currentState
                        );
                    }
                }}
            />
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
