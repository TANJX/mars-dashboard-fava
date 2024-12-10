import { useEffect, useState } from 'react';

function App() {
  const [marsDashboardData, setMarsDashboardData] = useState({ accounts: [], rows: [] });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        // Get today's date and 30 days ago for the date range
        const endDate = new Date().toISOString().split('T')[0];
        const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        
        const response = await fetch(
          `/mars-universe-bank/extension/MarsDashboard/get_data?start_date=${startDate}&end_date=${endDate}`
        );
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const rawData = await response.text();
        // Since the endpoint returns URL-encoded JSON, we need to decode it
        const decodedData = decodeURIComponent(rawData);
        const data = JSON.parse(decodedData);
        
        setMarsDashboardData(data);
      } catch (err) {
        console.error('Error fetching data:', err);
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();

    return () => {
    };
  }, []);

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return <div>Error: {error}</div>;
  }

  return (
    <div>
      <table>
        <thead>
          <tr>
            <th className="text-white font-bold bg-[#111] sticky top-0 z-[1]">Date</th>
            {marsDashboardData.accounts.map(account => {
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
          {marsDashboardData.rows.map(row => {
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
                {marsDashboardData.accounts.map(account => {
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
    </div>
  );
}

export default App;
