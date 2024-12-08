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
from fava.helpers import FavaAPIError
from decimal import Decimal


class MarsDashboard(FavaExtensionBase):
    report_title = "Mars Dashboard"
    # has_js_module = True

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
        return [
            (entry[0].date, entry[2].get("USD", Decimal("0")))
            for entry in entries
            if isinstance(entry[0], Transaction)
            and isinstance(entry[2], SimpleCounterInventory)
        ]

    def formatCurrency(number):
        if number < 0:
            return f"-${abs(number.quantize(Decimal('1.00')))}"
        return f"${number.quantize(Decimal('1.00'))}"

    def bootstrap(self):
        accounts = [
            k
            for k in self.ledger.accounts.keys()
            if k.startswith("Assets:Checking") or k.startswith("Assets:Saving")
        ]

        # First get all account entries
        account_entries = {
            account: self.get_account_entries(account) for account in accounts
        }

        # Then iterate through dates and look up balances
        rows = []
        date_first, date_last = self.get_ledger_duration(g.filtered.entries)
        current_date = date_first

        while current_date <= date_last:
            row = {"date": current_date}
            for account in accounts:
                # Find the last entry before or on current_date
                entries = account_entries[account]
                row[account] = {
                    "balance": Decimal("0"),
                    "transaction": Decimal("0"),
                    "description": set(),
                }
                for entry_date, amount in entries:
                    if entry_date <= current_date:
                        row[account]["balance"] = amount
                    else:
                        break
            rows.append(row)
            current_date += datetime.timedelta(days=1)

        query = """SELECT account, date, payee, position WHERE account ~ "^Assets:Saving" OR account ~ "^Assets:Checking" """
        rtypes, rrows = self.exec_query(query)

        # 0 - account, 1 - date, 2 - payee, 3 - position
        for entry in rrows:
            if not entry:
                continue
            # get index of the row by date difference
            index = int((entry.date - date_first).days) - 1
            if index < 0:
                continue
            row = rows[index]
            row[entry.account]["transaction"] += entry.position.units.number
            # get the first two words of payee
            words = entry.payee.split()[:2]
            if len(words) >= 2:
                row[entry.account]["description"].add(f"{words[0]} {words[1]}")
            elif len(words) == 1:
                row[entry.account]["description"].add(f"{words[0]}")

        # clean up the data, use $xxx.xx format for balance, and remove trailing ", " for description
        for row in rows:
            for account in accounts:
                row[account][
                    "balance"
                ] = self.formatCurrency(row[account]['balance'])
                row[account][
                    "transaction"
                ] = self.formatCurrency(row[account]['transaction'])
                row[account]["description"] = ", ".join(row[account]["description"])

        return {
            "accounts": accounts,
            "rows": rows,
        }
