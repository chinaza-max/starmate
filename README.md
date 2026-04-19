# Cleaning Service Management API

A production-ready Node.js Express API for managing a cleaning service business. It features role-based authentication, quote-to-booking conversion, automated invoicing, and task management.

## Features

- **Authentication**: Role-based access control (Admin, Client, Staff) using JWT.
- **Quote Management**: Create quotes with items, calculate subtotals, service charges, and discounts. Send quotes via email.
- **Booking Management**: Convert accepted quotes into bookings.
- **Invoicing**: Automatic invoice generation upon booking creation.
- **Task Management**: Create tasks for bookings and assign them to staff.
- **Data Persistence**: MySQL with Sequelize ORM.

## Prerequisites

- Node.js (v14 or higher)
- MySQL Server
- SMTP account (for email functionality, e.g., Mailtrap)

## Installation

1. Clone the repository and navigate to the project directory.

2. Install dependencies:
    npm install

3. Create a `.env` file in the root directory:
    cp .env.example .env

4. Configure your environment variables in `.env`:
    - Set your MySQL credentials (`DB_HOST`, `DB_USER`, `DB_PASS`, `DB_NAME`).
    - Set your `JWT_SECRET`.
    - Set your SMTP credentials for email.

5. Create the MySQL database:
    CREATE DATABASE cleaning_service_db;

## How to Run

### Development Mode
Runs the server with `nodemon` for automatic restarts on file changes:
    npm run dev

### Production Mode
    npm start

## Project Structure

- `src/config`: Database and configuration setup.
- `src/models`: Sequelize models and relationships.
- `src/controllers`: Business logic for handling requests.
- `src/routes`: API route definitions.
- `src/middleware`: Authentication, authorization, and validation.
- `src/services`: Utility services (Email, Calculations).

## Usage Examples

### 1. Register a User
- **POST** `/api/auth/register`
- Body:
    {
      "firstName": "John",
      "lastName": "Doe",
      "email": "john@example.com",
      "password": "password123",
      "role": "CLIENT",
      "address": "123 Main St"
    }

### 2. Login
- **POST** `/api/auth/login`
- Body:
    {
      "email": "john@example.com",
      "password": "password123"
    }

### 3. Create a Quote (Admin only)
- **POST** `/api/quotes`
- Header: `Authorization: Bearer <token>`
- Body:
    {
      "clientId": "client-uuid",
      "items": [
        { "itemId": "item-uuid", "quantity": 2 }
      ],
      "serviceCharge": 10.00,
      "discount": 5.00
    }

## Troubleshooting

- **Database Connection**: Ensure MySQL is running and credentials in `.env` are correct.
- **JWT Errors**: Ensure `JWT_SECRET` is set in the `.env` file.
- **Email Failures**: Verify your SMTP settings. Using a service like Mailtrap is recommended for development.
