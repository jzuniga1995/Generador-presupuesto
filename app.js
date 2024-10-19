let db;

// Configuración para cargar el archivo WASM desde el CDN
const config = {
    locateFile: (filename) => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.5.0/${filename}`
};

// Inicializar la base de datos con SQL.js
initSqlJs(config).then(function (SQL) {
    loadDatabase(SQL);  // Cargar la base de datos una vez SQL.js esté listo
}).catch((err) => {
    console.error("Error al inicializar SQL.js: ", err);
});

// Cargar la base de datos desde LocalStorage o crear una nueva
function loadDatabase(SQL) {
    const savedDb = localStorage.getItem('db');
    if (savedDb) {
        const binaryArray = new Uint8Array(JSON.parse(savedDb));
        db = new SQL.Database(binaryArray);  // Cargar la base de datos desde LocalStorage
        console.log("Base de datos cargada desde LocalStorage");
    } else {
        db = new SQL.Database();  // Crear una nueva base de datos si no existe
        db.run("CREATE TABLE IF NOT EXISTS transactions (id INTEGER PRIMARY KEY AUTOINCREMENT, description TEXT, amount REAL, type TEXT);");
        console.log("Base de datos creada");
    }

    loadTransactions();  // Cargar las transacciones desde la base de datos
}

// Guardar el estado de la base de datos en LocalStorage
function saveDatabase() {
    const data = db.export();  // Exportar la base de datos a formato binario
    localStorage.setItem('db', JSON.stringify(Array.from(data)));
    console.log("Base de datos guardada en LocalStorage");
}

// Agregar una nueva transacción
function addItem() {
    const description = document.getElementById('description').value;
    const amount = parseFloat(document.getElementById('amount').value);
    const type = document.getElementById('type').value;

    if (description && !isNaN(amount) && amount > 0) {
        const stmt = db.prepare("INSERT INTO transactions (description, amount, type) VALUES (?, ?, ?)");
        stmt.run([description, amount, type]);
        stmt.free();
        
        saveDatabase();
        loadTransactions();

        // Limpiar los campos
        document.getElementById('description').value = '';
        document.getElementById('amount').value = '';
    } else {
        alert('Por favor, ingresa una descripción y un monto válido.');
    }
}

// Cargar y renderizar las transacciones
function loadTransactions() {
    const stmt = db.prepare("SELECT * FROM transactions");
    const rows = [];

    while (stmt.step()) {
        const row = stmt.getAsObject();
        rows.push(row);
    }

    stmt.free();

    // Limpiar la tabla de transacciones
    document.getElementById('items').innerHTML = '';

    rows.forEach(row => {
        renderItem(row);
    });

    updateSummary();  // Actualizar el resumen de ingresos, gastos y balance
}

// Renderizar una transacción en la tabla
// Renderizar una transacción en la tabla
function renderItem(item) {
    const row = document.createElement('tr');
    
    // Verificar si el modo oscuro está activo y agregar la clase dark-mode a la fila
    const darkModeActive = document.body.classList.contains('dark-mode');
    
    row.innerHTML = `
        <td>${item.description}</td>
        <td class="${item.type === 'income' ? 'income' : 'expense'}">
            L. ${item.amount.toFixed(2)}
        </td>
        <td>${item.type === 'income' ? 'Ingreso' : 'Gasto'}</td>
        <td>
            <button onclick="deleteTransaction(${item.id})" class="btn-delete ${darkModeActive ? 'dark-mode' : ''}">
                <i class="fas fa-trash-alt"></i> Eliminar
            </button>
        </td>
    `;
    
    // Si el modo oscuro está activo, agregar la clase dark-mode a la fila
    if (darkModeActive) {
        row.classList.add('dark-mode');
    }

    document.getElementById('items').appendChild(row);
}


// Eliminar una transacción de la base de datos
function deleteTransaction(id) {
    const stmt = db.prepare("DELETE FROM transactions WHERE id = ?");
    stmt.run([id]);
    stmt.free();

    saveDatabase();
    loadTransactions();
}

// Actualizar el resumen del presupuesto
function updateSummary() {
    const stmtIncome = db.prepare("SELECT SUM(amount) as totalIncome FROM transactions WHERE type = 'income'");
    const stmtExpenses = db.prepare("SELECT SUM(amount) as totalExpenses FROM transactions WHERE type = 'expense'");

    let totalIncome = 0;
    let totalExpenses = 0;

    if (stmtIncome.step()) {
        totalIncome = stmtIncome.getAsObject().totalIncome || 0;
    }
    if (stmtExpenses.step()) {
        totalExpenses = stmtExpenses.getAsObject().totalExpenses || 0;
    }

    stmtIncome.free();
    stmtExpenses.free();

    const balance = totalIncome - totalExpenses;

    document.getElementById('total-income').textContent = totalIncome.toFixed(2);
    document.getElementById('total-expenses').textContent = totalExpenses.toFixed(2);
    document.getElementById('balance').textContent = balance.toFixed(2);

    updateChart(totalIncome, totalExpenses);  // Actualizar el gráfico
}

// Actualizar el gráfico de ingresos y gastos
let chart;

function updateChart(totalIncome, totalExpenses) {
    const ctx = document.getElementById('budgetChart').getContext('2d');
    if (chart) {
        chart.destroy();
    }
    chart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Ingresos', 'Gastos'],
            datasets: [{
                label: 'Distribución del Presupuesto',
                data: [totalIncome, totalExpenses],
                backgroundColor: ['#28a745', '#dc3545'],
                borderColor: ['#28a745', '#dc3545'],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'top',
                },
            },
        }
    });
}

function toggleDarkMode() {
    document.body.classList.toggle('dark-mode');
    document.querySelector('.container').classList.toggle('dark-mode');
}



// Exportar los datos a Excel
function exportToExcel() {
    // Crear un array de datos para la hoja de cálculo
    const data = [];
    data.push(['Descripción', 'Monto', 'Tipo']); // Cabecera de las columnas

    const stmt = db.prepare("SELECT * FROM transactions");
    
    while (stmt.step()) {
        const item = stmt.getAsObject();
        data.push([item.description, item.amount, item.type === 'income' ? 'Ingreso' : 'Gasto']);
    }
    
    stmt.free();

    // Crear una hoja de cálculo
    const ws = XLSX.utils.aoa_to_sheet(data); // Convertir el array a una hoja de cálculo
    const wb = XLSX.utils.book_new(); // Crear un nuevo libro de trabajo
    XLSX.utils.book_append_sheet(wb, ws, 'Presupuesto'); // Agregar la hoja al libro de trabajo

    // Generar el archivo Excel y descargarlo
    XLSX.writeFile(wb, 'presupuesto.xlsx');
}


