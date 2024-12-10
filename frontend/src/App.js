import { useEffect, useState, useCallback } from 'react';

function App() {
  const [marsDashboardData, setMarsDashboardData] = useState({ accounts: [], rows: [] });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [cachedDates, setCachedDates] = useState({ startDate: null, endDate: null });

  const fetchData = useCallback(async () => {
    try {
      const startDateEl = document.getElementById('start-date');
      const endDateEl = document.getElementById('end-date');

      if (!startDateEl || !endDateEl) {
        return;
      }

      const startDate = startDateEl.textContent;
      const endDate = endDateEl.textContent;

      if (startDate === cachedDates.startDate && endDate === cachedDates.endDate) {
        return;
      }

      setCachedDates({ startDate, endDate });
      console.log('Updated cached dates');

      setIsLoading(true);
      const response = await fetch(
        `/mars-universe-bank/extension/MarsDashboard/get_data?start_date=${startDate}&end_date=${endDate}`
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const rawData = await response.text();
      const data = JSON.parse(rawData);

      setMarsDashboardData(data);
      console.log('Updated dashboard data');
    } catch (err) {
      console.error('Error fetching data:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [cachedDates]);

  // add a timer to fetch data every 1 seconds
  useEffect(() => {
    const interval = setInterval(fetchData, 500);
    return () => clearInterval(interval);
  }, [fetchData]);

  // useEffect(() => {
  //   console.log('useEffect triggered with cachedDates:', cachedDates);

  //   // Create observer for the entire document body
  //   console.log('Setting up document observer');
  //   const documentObserver = new MutationObserver((mutations) => {
  //     console.log('Document mutation detected:', mutations);
  //     mutations.forEach((mutation) => {
  //       // Check if our target elements were added
  //       const startDateEl = document.getElementById('start-date');
  //       const endDateEl = document.getElementById('end-date');

  //       if (startDateEl && endDateEl) {
  //         console.log('Target elements found, setting up date observers');
  //         // Create observer for the date elements
  //         const dateObserver = new MutationObserver((mutations) => {
  //           console.log('Date element mutation detected:', mutations);
  //           mutations.forEach((mutation) => {
  //             if (mutation.type === 'characterData' || mutation.type === 'childList') {
  //               console.log('Date content changed, triggering fetch');
  //               fetchData();
  //             }
  //           });
  //         });

  //         // Observe both date elements
  //         dateObserver.observe(startDateEl, { characterData: true, childList: true });
  //         dateObserver.observe(endDateEl, { characterData: true, childList: true });

  //         // Initial fetch once elements are found
  //         console.log('Triggering initial fetch');
  //         fetchData();

  //         // Stop observing document once we've found our elements
  //         console.log('Disconnecting document observer');
  //         documentObserver.disconnect();
  //       }
  //     });
  //   });

  //   // Start observing the document for added nodes
  //   documentObserver.observe(document.body, {
  //     childList: true,
  //     subtree: true
  //   });
  //   console.log('Document observer started');

  //   // Cleanup function
  //   return () => {
  //     console.log('Cleaning up - disconnecting observer');
  //     documentObserver.disconnect();
  //   };
  // }, []);

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
