function MainTable({ dashboardData }) {
  return (
    <table>
    <thead>
      <tr>
        <th className="text-white font-bold bg-[#111] sticky top-0 z-[1]">Date</th>
        {dashboardData.accounts.map(account => {
          const accountShort = account.replace('Assets:Checking:', '').replace('Assets:Saving:', '');
          const accountClass = account.replace('Assets:', '').replace(':', '-').toLowerCase();
          const bgColor = accountClass === 'checking-amex' ? 'bg-[#0000ff]' :
            accountClass === 'checking-bofa' ? 'bg-[#cc0100]' :
              accountClass === 'saving-apple' ? 'bg-[#434343]' :
                accountClass === 'saving-discover' ? 'bg-[#ff6d01]' :
                  accountClass === 'checking-citi' ? 'bg-[#1255cc]' : 'bg-[#111]';
          return (
            <>
              <th className={`text-white font-bold sticky top-0 z-[1] ${bgColor}`}>
                {accountShort}
              </th>
              <th className={`text-white font-bold sticky top-0 z-[1] ${bgColor}`}>Transaction</th>
              <th className={`text-white font-bold sticky top-0 z-[1] w-[150px] max-w-[150px] whitespace-nowrap overflow-hidden text-ellipsis text-left ${bgColor}`}>Notes</th>
            </>
          );
        })}
      </tr>
    </thead>
    <tbody className="text-right">
      {dashboardData.rows.map(row => {
        const today = new Date().toISOString().split('T')[0];
        const isToday = row.date === today;
        const isPast = row.date < today;

        return (
          <tr>
            <td className={`
              ${isToday ? 'font-bold underline' : ''} 
              ${isPast ? 'text-gray-300 italic' : ''}
            `}>
              {row.date}
            </td>
            {dashboardData.accounts.map(account => {
              return (
                <>
                  <td className={isPast ? 'text-gray-300' : ''}>
                    {row[account].balance}
                  </td>
                  <td className={isPast ? 'text-gray-300' : ''}>
                    {row[account].transaction}
                  </td>
                  <td className={`w-[150px] max-w-[150px] whitespace-nowrap overflow-hidden text-ellipsis text-left ${isPast ? 'text-gray-300' : ''}`}>
                    {row[account].description}
                  </td>
                </>
              );
            })}
          </tr>
        );
      })}
    </tbody>
  </table>
  );
}

export default MainTable;