# DDPL Procurement Portal (Decent Decor Pvt. Ltd)

Enterprise Procurement & Material Requisition System built with **React (Vite)**, **Node.js (Express.js)**, and **PostgreSQL**.

---

## 🏗️ Architecture

This repository strictly follows the **Route ➔ Controller ➔ Service ➔ Model** architecture:
- **Routes:** Endpoint definition and middleware chaining.
- **Controllers:** Request/Response handling and HTTP status mapping.
- **Services:** Pure business logic, authorization, sequential PR number generation, and atomic multi-table transactions.
- **Models:** Pure database queries using Parameterized Queries with connection pooling to prevent SQL injection.

---

## 🚀 Quick Start Guide

### 1. Database Setup (PostgreSQL)
1. Ensure **PostgreSQL** service is running (Port `5432`).
2. Database: `ddpl_procurement`
3. Credentials configured in `backend/.env`:
   - `DB_HOST=127.0.0.1`
   - `DB_PORT=5432`
   - `DB_USER=postgres`
   - `DB_PASSWORD=root`
   - `DB_NAME=ddpl_procurement`
4. If migrating from XAMPP MySQL to PostgreSQL, run:
   ```bash
   cd backend
   node src/scripts/migrate_mysql_to_postgres.js
   ```

### 2. Backend Setup
```bash
cd backend
npm install
npm run dev
```
Backend will run at: `http://localhost:5000`
- API Base: `http://localhost:5000/api/v1`
- Health check: `http://localhost:5000/health`

### 3. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```
Frontend will run at: `http://localhost:5173`

---

## 🔑 Default Login Credentials
- **Email:** `admin@ddpl.com`
- **Password:** `Admin@123`
- **Role:** `admin`

---

## 📁 Repository Structure
```text
ddpl-procurement-portal/
├── backend/
│   ├── src/
│   │   ├── config/db.js              # PostgreSQL Connection Pool & Query Adapter
│   │   ├── constants/roles.js        # RBAC Roles
│   │   ├── middlewares/              # JWT, Roles, Joi Validator, Error Handler
│   │   ├── modules/
│   │   │   ├── auth/                 # Route -> Controller -> Service -> Model
│   │   │   └── requisitions/         # PR CRUD + Search + Pagination
│   │   ├── scripts/schema.sql        # Reference SQL Schema
│   │   ├── scripts/migrate_mysql_to_postgres.js # Automated PostgreSQL Migration
│   │   └── server.js                 # Express Entry point (CORS, Helmet, Rate Limit)
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/layout/        # Navbar, Sidebar, ProtectedRoute
│   │   ├── context/AuthContext.jsx   # JWT state & session
│   │   ├── pages/                    # Login, Dashboard, PR List, PR Form, PR Detail
│   │   ├── services/                 # Axios API service layer
│   │   ├── styles/                   # Modern Design System (index.css, App.css)
│   │   └── App.jsx                   # React Router v6
│   └── package.json
└── README.md
```
