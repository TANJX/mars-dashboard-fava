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
    format?: {
        transaction?: {
            bold?: boolean;
            italic?: boolean;
        };
        description?: {
            bold?: boolean;
            italic?: boolean;
        };
    };
}

export interface DashboardData {
    rows: DashboardRow[];
    accounts: string[];
    user_transactions?: UserTransaction[];
}

export interface CellEditorValue {
    value: string;
    format?: {
        bold?: boolean;
        italic?: boolean;
    };
}
