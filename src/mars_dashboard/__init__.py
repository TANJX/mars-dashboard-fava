import json
import os
from typing import List
import datetime
from collections import namedtuple
from beanquery.query import run_query  # type: ignore
from fava.core.inventory import SimpleCounterInventory
from fava.beans.abc import Directive
from fava.beans.abc import Price
from fava.beans.abc import Transaction
from fava.context import g
from fava.ext import FavaExtensionBase
from fava.ext import extension_endpoint
from fava.helpers import FavaAPIError
from decimal import Decimal
from flask import request  # Add this import at the top


class MarsDashboard(FavaExtensionBase):
    report_title = "Mars Dashboard"
    excluded_accounts = ["Assets:Checking:Future", "Assets:Checking:Optum", "Assets:Checking:Amy-PrimePay"]
    has_js_module = True

    @extension_endpoint
    def get_balance(self):
        account = request.args.get("account")
        query = """SELECT account WHERE (account ~ "Assets:Checking" OR account ~ "Assets:Saving" OR account ~ "Liabilities:Credit" OR account ~ "Assets:Investment:Robinhood:Brokerage:USD" OR account ~ "Assets:Investment:Robinhood:Traditional-IRA:USD" OR account ~ "Assets:Investment:Robinhood:Roth-IRA:USD") AND NOT close_date(account) GROUP BY account"""
        _, rrows = self.exec_query(query)
        # get all accounts that match the query
        accounts = [row.account for row in rrows if account in row.account.lower()]
        results = {}
        for account in accounts:
            # get the last entry where the date is today or earlier
            entries = self.get_account_entries(account)
            current_date = datetime.datetime.now().date() + datetime.timedelta(days=1)
            last_entry = next(
                (entry for entry in reversed(entries) if entry[0] <= current_date), None
            )
            if last_entry:
                balance = float(last_entry[1])
            else:
                balance = 0
            results[account] = balance
        return json.dumps(results)

    @extension_endpoint
    def get_data(self):

        start_date = request.args.get("start_date")
        end_date = request.args.get("end_date")

        if not start_date or not end_date:
            return {}

        date_first = datetime.datetime.strptime(start_date, "%Y-%m-%d").date()
        date_last = datetime.datetime.strptime(end_date, "%Y-%m-%d").date()

        all_accounts = [
            k
            for k in self.ledger.accounts.keys()
            if (
                k.startswith("Assets:Checking")
                or k.startswith("Assets:Saving")
                or k.startswith("Assets:Investment:Robinhood:Brokerage:USD")
            )
            and k not in self.excluded_accounts
        ]

        # First get all account entries and filter out accounts with no entries
        account_entries = {}
        for account in all_accounts:
            entries = self.get_account_entries(account)
            if entries:  # Only include accounts that have entries
                account_entries[account] = entries

        accounts = sorted(account_entries.keys())

        # Then iterate through dates and look up balances
        rows = []

        # date_first, date_last = self.get_ledger_duration(g.filtered.entries)
        current_date = date_first

        while current_date <= date_last:
            row = {"date": current_date}
            for account in accounts:
                # Find the last entry before or on current_date
                entries = account_entries[account]
                row[account] = {
                    "balance": Decimal("0"),
                    "transaction": [],
                    "description": set(),
                }
                for entry_date, amount in entries:
                    if entry_date <= current_date:
                        row[account]["balance"] = amount
                    else:
                        break
            rows.append(row)
            current_date += datetime.timedelta(days=1)

        query = """SELECT account, date, payee, position WHERE account ~ "^Assets:Saving" OR account ~ "^Assets:Checking" OR account ~ "Assets:Investment:Robinhood:Brokerage:USD" """
        _, rrows = self.exec_query(query)

        # 0 - account, 1 - date, 2 - payee, 3 - position
        for entry in rrows:
            if not entry or entry.account not in accounts:
                continue
            # get index of the row by date difference
            index = int((entry.date - date_first).days)
            if index < 0 or index >= len(rows):
                continue
            row = rows[index]
            if "transaction" not in row[entry.account]:
                row[entry.account]["transaction"] = []
            row[entry.account]["transaction"].append(entry.position.units.number)
            # get the first two words of payee
            words = entry.payee.split()[:2] if entry.payee else [""]
            if len(words) >= 2:
                row[entry.account]["description"].add(f"{words[0]} {words[1]}")
            elif len(words) == 1:
                row[entry.account]["description"].add(f"{words[0]}")

        # clean up the data, use $xxx.xx format for balance, and remove trailing ", " for description
        for row in rows:
            for account in accounts:
                row[account]["balance"] = self.formatCurrency(row[account]["balance"])
                if len(row[account]["transaction"]) == 1:
                    row[account]["transaction"] = self.formatCurrency(
                        row[account]["transaction"][0], hideZero=True
                    )
                elif len(row[account]["transaction"]) > 1:
                    # join the transaction as formula "=123+123-123"
                    combined = "="
                    for n in row[account]["transaction"]:
                        if float(n) < 0:
                            combined += f"{n}"
                        else:
                            combined += f"+{n}"
                    row[account]["transaction"] = combined
                else:
                    row[account]["transaction"] = ""
                row[account]["description"] = ", ".join(row[account]["description"])

        print(f"Fetched {len(rows)} rows for {start_date} to {end_date}")

        user_transactions_path = os.path.join(
            os.path.dirname(g.ledger.beancount_file_path), "user_transactions.jsonl"
        )
        user_transactions = []

        if os.path.exists(user_transactions_path):
            with open(user_transactions_path, "r") as f:
                for line in f:
                    user_transactions.append(json.loads(line))
        # Create a map of existing transactions for efficient lookup and merging
        transaction_map = {}
        for transaction in user_transactions:
            key = (transaction["date"], transaction["account"])
            if key not in transaction_map:
                transaction_map[key] = transaction
            else:
                # Merge transaction data, keeping the latest entry
                existing = transaction_map[key]
                if "transaction" in transaction:
                    existing["transaction"] = transaction["transaction"]
                if "description" in transaction:
                    existing["description"] = transaction["description"]
                if "format" in transaction:
                    # Merge format data
                    if "format" not in existing:
                        existing["format"] = {}
                    existing["format"].update(transaction["format"])

                # Ensure both transaction and description fields exist
                if "transaction" not in existing:
                    existing["transaction"] = ""
                if "description" not in existing:
                    existing["description"] = ""

                if (
                    existing["transaction"] == ""
                    and existing["description"] == ""
                    and not existing.get("format")
                ):
                    del transaction_map[key]

        # Convert back to list
        user_transactions = list(transaction_map.values())

        return json.dumps(
            {
                "accounts": accounts,
                "rows": rows,
                "user_transactions": user_transactions,
            },
            default=str,
        )

    """
    Format:
    { date, account, transaction, description }
    Append the transaction as jsonl to the ledger root directory
    """

    @extension_endpoint(methods=["POST"])
    def save_user_transaction(self):
        data = request.json
        # Validate the format structure if present
        if "format" in data:
            if not isinstance(data["format"], dict):
                return json.dumps(
                    {"status": "error", "message": "Invalid format structure"}
                )

            valid_fields = ["transaction", "description"]
            valid_formats = ["bold", "italic"]

            for field, format_data in data["format"].items():
                if field not in valid_fields:
                    return json.dumps(
                        {"status": "error", "message": f"Invalid field {field}"}
                    )
                if not isinstance(format_data, dict):
                    return json.dumps(
                        {
                            "status": "error",
                            "message": f"Invalid format data for {field}",
                        }
                    )
                for format_type in format_data:
                    if format_type not in valid_formats:
                        return json.dumps(
                            {
                                "status": "error",
                                "message": f"Invalid format type {format_type}",
                            }
                        )

        file_path = os.path.join(
            os.path.dirname(g.ledger.beancount_file_path), "user_transactions.jsonl"
        )
        with open(file_path, "a") as f:
            f.write(json.dumps(data) + "\n")
        return json.dumps({"status": "success"})

    def get_ledger_duration(self, entries: List[Directive]):
        date_first = None
        date_last = None
        for entry in entries:
            if isinstance(entry, Transaction):
                date_first = entry.date
                break
        for entry in reversed(entries):
            if isinstance(entry, (Transaction, Price)):
                date_last = entry.date
                break
        if not date_first or not date_last:
            raise FavaAPIError("no transaction found")
        return (date_first, date_last)

    def exec_query(self, query):
        try:
            rtypes, rrows = run_query(g.filtered.entries, self.ledger.options, query)
        except Exception as ex:
            raise FavaAPIError(f"failed to execute query {query}: {ex}") from ex

        # convert to legacy beancount.query format for backwards compat
        result_row = namedtuple("ResultRow", [col.name for col in rtypes])
        rtypes = [(t.name, t.datatype) for t in rtypes]
        rrows = [result_row(*row) for row in rrows]

        return rtypes, rrows

    def get_account_entries(self, account):
        entries = g.ledger.account_journal(
            g.filtered,
            account,
            g.conversion,
            with_children=g.ledger.fava_options.account_journal_include_children,
        )
        result = [
            (entry[0].date, entry[2].get("USD", Decimal("0")))
            for entry in entries
            if isinstance(entry[0], Transaction)
            and isinstance(entry[2], SimpleCounterInventory)
        ]
        # shift the entry date by 1 day
        return [(entry[0] + datetime.timedelta(days=1), entry[1]) for entry in result]

    def formatCurrency(self, number, hideZero=False):
        if hideZero and number == Decimal("0"):
            return ""
        return number.quantize(Decimal("1.00"))
        # if number < 0:
        # return f"-${abs(number.quantize(Decimal('1.00')))}"
        # return f"${number.quantize(Decimal('1.00'))}"

    def bootstrap(self):
        # return start and end date
        date_first, date_last = self.get_ledger_duration(g.filtered.entries)

        # Add 1 day to date_first
        date_first_obj = datetime.datetime.strptime(
            str(date_first), "%Y-%m-%d"
        ) + datetime.timedelta(days=1)
        date_first = date_first_obj.strftime("%Y-%m-%d")

        # Get last day of month for date_last
        date_last_obj = datetime.datetime.strptime(str(date_last), "%Y-%m-%d")
        next_month = date_last_obj.replace(day=28) + datetime.timedelta(days=4)
        last_day = next_month - datetime.timedelta(days=next_month.day)
        date_last = last_day.strftime("%Y-%m-%d")

        return {
            "start_date": date_first,
            "end_date": date_last,
        }
