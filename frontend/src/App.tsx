import { useEffect, useState, useCallback } from 'react';
// import MainTable from './components/MainTable';
import AGTable from './components/AGTable';

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
        `http://127.0.0.1:5000/mars-universe-bank/extension/MarsDashboard/get_data?start_date=${startDate}&end_date=${endDate}`
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const rawData = await response.text();
      const data = JSON.parse(rawData);
      // add an extra month to the data
      // const lastDate = data.rows[data.rows.length - 1].date;
      const lastRow = structuredClone(data.rows[data.rows.length - 1]);
      // remove all transaction values
      Object.keys(lastRow).forEach(key => {
        if (key !== 'date') {
          lastRow[key].transaction = '';
          lastRow[key].description = '';
        }
      });
      const dateObj = new Date(lastRow.date);
      for (let i = 0; i < 31; i++) {
        dateObj.setDate(dateObj.getDate() + 1);
        const nextDate = dateObj.toISOString().split('T')[0];
        const newRow = structuredClone(lastRow);
        newRow.date = nextDate;
        data.rows.push(newRow);
      }
      console.log(data.rows);

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

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return <div>Error: {error}</div>;
  }

  return (
    <div>
      {/* <MainTable dashboardData={marsDashboardData} /> */}
      <AGTable dashboardData={marsDashboardData} />
    </div>
  );
}

export default App;