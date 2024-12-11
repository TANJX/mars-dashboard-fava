import { AgGridReact } from 'ag-grid-react';
import { useMemo } from 'react';

function AGTable({ dashboardData }) {
  // Create column definitions
  const columnDefs = useMemo(() => {
    const columns = [
      {
        field: 'date',
        headerName: 'Date',
        pinned: 'left',
        width: 120,
        cellStyle: params => {
          const today = new Date().toISOString().split('T')[0];
          const isToday = params.value === today;
          const isPast = params.value < today;
          
          return {
            fontWeight: isToday ? 'bold' : 'normal',
            textDecoration: isToday ? 'underline' : 'none',
            color: isPast ? '#D1D5DB' : 'inherit',
            fontStyle: isPast ? 'italic' : 'normal'
          };
        }
      }
    ];

    // Add columns for each account
    dashboardData.accounts.forEach(account => {
      const accountShort = account.replace('Assets:Checking:', '').replace('Assets:Saving:', '');
      const accountClass = account.replace('Assets:', '').replace(':', '-').toLowerCase();
      
      const headerBgColor = 
        accountClass === 'checking-amex' ? '#0000ff' :
        accountClass === 'checking-bofa' ? '#cc0100' :
        accountClass === 'saving-apple' ? '#434343' :
        accountClass === 'saving-discover' ? '#ff6d01' :
        accountClass === 'checking-citi' ? '#1255cc' : '#111';

      columns.push(
        {
          headerName: accountShort,
          field: `${account}.balance`,
          headerStyle: { backgroundColor: headerBgColor, color: 'white' },
          width: 100,
          cellStyle: params => ({
            textAlign: 'right',
            color: isPastDate(params.data.date) ? '#D1D5DB' : 'inherit'
          })
        },
        {
          headerName: 'Transaction',
          field: `${account}.transaction`,
          editable: true,
          headerStyle: { backgroundColor: headerBgColor, color: 'white' },
          width: 100,
          cellStyle: params => ({
            textAlign: 'right',
            color: isPastDate(params.data.date) ? '#D1D5DB' : 'inherit'
          })
        },
        {
          headerName: 'Notes',
          field: `${account}.description`,
          editable: true,
          headerStyle: { backgroundColor: headerBgColor, color: 'white' },
          width: 150,
          cellStyle: params => ({
            textAlign: 'left',
            color: isPastDate(params.data.date) ? '#D1D5DB' : 'inherit',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          })
        }
      );
    });

    return columns;
  }, [dashboardData.accounts]);

  const isPastDate = date => {
    const today = new Date().toISOString().split('T')[0];
    return date < today;
  };

  return (
    <div className="ag-theme-alpine" style={{ height: '100vh', width: '100%' }}>
      <AgGridReact
        columnDefs={columnDefs}
        rowData={dashboardData.rows}
        defaultColDef={{
          sortable: false,
          filter: false,
          resizable: true
        }}
        // suppressColumnVirtualisation={true}
      />
    </div>
  );
}

export default AGTable;