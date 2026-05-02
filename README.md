# DEI — Sistema de Test Psicológicos

Sistema web local para intranet. Gestión de eventos de test psicológicos con control de acceso, licencias y reportes PDF.

---

## Requisitos previos

- **Node.js v18 o superior** → https://nodejs.org/
- **npm v9 o superior** (incluido con Node.js)
- Windows / Linux / macOS

Verificar versiones:
```bash
node -v
npm -v
```

---

## Instalación y ejecución (paso a paso)

### 1. Backend

```bash
cd backend
npm install
npm run setup
npm run dev
```

> `npm run setup` ejecuta las migraciones y el seed inicial (entidad DEI, usuario admin, test con 40 preguntas, evento de ejemplo).

El backend quedará corriendo en: `http://localhost:4000`

Verificar: `http://localhost:4000/api/health`

---

### 2. Frontend

Abrir **otra terminal**:

```bash
cd frontend
npm install
npm run dev
```

El frontend quedará disponible en: `http://localhost:3000`

---

## Credenciales iniciales

| Campo      | Valor                      |
|------------|----------------------------|
| Email      | mikenoecarcamo@gmail.com   |
| Contraseña | 123456789                  |
| Rol        | ADMIN                      |

> El sistema forzará cambio de contraseña en el primer inicio de sesión.

---

## Estructura del proyecto

```
DEI/
├── backend/
│   ├── src/
│   │   ├── index.js              ← Punto de entrada del servidor
│   │   ├── db/
│   │   │   ├── database.js       ← Conexión SQLite
│   │   │   ├── migrate.js        ← Creación de tablas
│   │   │   └── seed.js           ← Datos iniciales
│   │   ├── middleware/
│   │   │   ├── auth.js           ← JWT + roles
│   │   │   └── audit.js          ← Logs de auditoría
│   │   ├── routes/
│   │   │   ├── auth.js           ← Login, me, cambio contraseña
│   │   │   ├── entities.js       ← CRUD entidades
│   │   │   ├── users.js          ← CRUD usuarios
│   │   │   ├── tests.js          ← CRUD tests y preguntas
│   │   │   ├── events.js         ← CRUD eventos + asignación usuarios
│   │   │   ├── licenses.js       ← CRUD licencias
│   │   │   ├── responses.js      ← Envío y consulta de respuestas
│   │   │   └── reports.js        ← Generación PDF
│   │   └── utils/
│   │       ├── scoring.js        ← Cálculo de temperamento
│   │       └── pdf.js            ← Generación PDFKit
│   ├── data/                     ← Base de datos SQLite (creada automáticamente)
│   ├── .env
│   ├── .env.example
│   └── package.json
│
└── frontend/
    ├── src/
    │   ├── main.jsx
    │   ├── App.jsx               ← Router principal
    │   ├── api/axios.js          ← Cliente HTTP + interceptores
    │   ├── context/AuthContext   ← Estado de autenticación global
    │   ├── components/
    │   │   ├── Layout.jsx        ← Navbar + Drawer lateral
    │   │   └── ProtectedRoute.jsx
    │   └── pages/
    │       ├── Login.jsx
    │       ├── ChangePassword.jsx
    │       ├── user/
    │       │   ├── Dashboard.jsx ← Cards de test disponibles
    │       │   └── TestForm.jsx  ← Formulario + resultado
    │       └── admin/
    │           ├── AdminDashboard.jsx
    │           ├── Entities.jsx
    │           ├── Users.jsx
    │           ├── Tests.jsx
    │           ├── Events.jsx
    │           ├── Licenses.jsx
    │           └── Reports.jsx
    ├── index.html
    ├── vite.config.js
    └── package.json
```

---

## Variables de entorno (backend)

Archivo: `backend/.env`

```env
PORT=4000
JWT_SECRET=cambia_este_secreto_muy_seguro_2024
JWT_EXPIRES_IN=8h
DB_PATH=./data/dei.sqlite
NODE_ENV=development
```

> **Importante:** Cambiar `JWT_SECRET` por una cadena larga y aleatoria antes de usar en producción.

---

## Acceso desde otras computadoras en la intranet

El sistema está configurado para escuchar en `0.0.0.0`, lo que permite acceso desde la red local.

### Pasos:

1. Obtener la IP local del servidor:
   ```bash
   # Windows
   ipconfig
   # Linux/Mac
   ip addr show
   ```
   Ejemplo: `192.168.1.100`

2. Desde otras computadoras en la misma red, abrir:
   ```
   http://192.168.1.100:3000
   ```

3. Si el firewall bloquea el acceso, abrir los puertos **3000** y **4000** en Windows Defender Firewall.

### Para producción en intranet (recomendado):

Construir el frontend y servirlo desde el backend:

```bash
# En frontend/
npm run build
# Los archivos quedan en frontend/dist/
```

Luego en `backend/src/index.js` agregar al final (antes del listen):
```js
app.use(express.static(path.join(__dirname, '../../frontend/dist')));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, '../../frontend/dist/index.html')));
```

Así solo necesita un proceso corriendo en el puerto 4000 accesible desde `http://IP_SERVIDOR:4000`.

---

## Scripts disponibles

### Backend
| Script          | Descripción                              |
|-----------------|------------------------------------------|
| `npm run dev`   | Servidor con nodemon (desarrollo)        |
| `npm start`     | Servidor sin nodemon (producción)        |
| `npm run migrate` | Solo ejecutar migraciones             |
| `npm run seed`  | Solo ejecutar seed                       |
| `npm run setup` | Migrar + seed (primera instalación)      |

### Frontend
| Script          | Descripción                              |
|-----------------|------------------------------------------|
| `npm run dev`   | Servidor de desarrollo con hot-reload    |
| `npm run build` | Compilar para producción                 |
| `npm run preview` | Vista previa del build               |

---

## Base de datos SQLite

- Ubicación: `backend/data/dei.sqlite`
- Se crea automáticamente al iniciar el backend.
- No requiere instalación de ningún servidor de base de datos.

### Backup recomendado

Copiar el archivo `dei.sqlite` a una ubicación segura:

```bash
# Windows (en backend/)
copy data\dei.sqlite backup\dei_backup_%date:~-4,4%%date:~-7,2%%date:~-10,2%.sqlite
```

**Recomendación:** Hacer backup diario automático con el Programador de tareas de Windows copiando `backend/data/dei.sqlite` a una carpeta de respaldo o unidad de red.

---

## Reglas de negocio implementadas

- Un usuario solo ve test activos, dentro del rango de fechas, con licencia válida y asignados a su entidad.
- No se puede llenar el mismo test dos veces con el mismo nombre en el mismo evento.
- Una licencia no puede asignarse a más de un evento.
- Las respuestas no se eliminan, solo se anulan (auditoría).
- Los eventos sin licencia activa no son visibles para los usuarios.
- El cambio de contraseña se fuerza en el primer inicio de sesión.

---

## Test de Personalidad incluido

- **40 preguntas** (20 fortalezas + 20 debilidades)
- **4 opciones por pregunta:** a=Sanguíneo, b=Colérico, c=Melancólico, d=Flemático
- **Cálculo:** conteo por letra → temperamento dominante y secundario
- **Empate:** se detecta y muestra ambos temperamentos
- **Conclusión automática** con fortalezas, áreas de mejora y recomendación
- **Nota obligatoria:** "Este resultado es orientativo y no constituye diagnóstico psicológico clínico"
