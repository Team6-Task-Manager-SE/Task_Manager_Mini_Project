
# Task Manager Application

## Software Engineering Mini Project — Team 6

### Project Overview

The Task Manager Application is a web-based software system designed to help individuals and teams efficiently create, organize, prioritize, monitor, and manage tasks.

The application aims to improve productivity, simplify task tracking, and support team collaboration through an intuitive and secure interface.

This project is developed as part of the Software Engineering Mini Project at PES University, Electronic City Campus, Department of Computer Science and Engineering.

---

## Project Objectives

- Develop a secure and user-friendly task management application.
- Allow users to create, update, delete, and organize tasks.
- Support task prioritization and status tracking.
- Enable collaboration among team members.
- Provide task notifications and deadline reminders.
- Implement dashboards and productivity reports.
- Maintain application security, performance, and reliability.
- Follow Agile software development practices.

---

## Key Features

### 1. User Authentication
- User registration and login.
- Secure password hashing.
- Password reset through email.
- Account lockout after repeated failed login attempts.
- Role-based access control.

### 2. Task Management
- Create, edit, and delete tasks.
- Update task status: To-Do, In Progress, Completed.
- Assign task priorities: Low, Medium, High.
- Organize tasks using tags and categories.
- Search, filter, and sort tasks.

### 3. Project Management
- Create and manage projects.
- Organize tasks using Kanban boards.
- Move tasks between different status columns.
- Track project and task progress.

### 4. Team Collaboration
- Invite team members to projects.
- Assign tasks to team members.
- Add comments to shared tasks.
- Receive real-time task assignment notifications.

### 5. Notifications
- Due-date notifications.
- Email reminders for overdue high-priority tasks.
- Real-time notifications for assigned tasks.

### 6. Reporting and Analytics
- Task dashboard summary.
- Weekly productivity reports.
- Administrative usage analytics.

### 7. Security and Performance
- Secure authentication and authorization.
- Input validation.
- TLS encryption.
- Responsive user interface.
- Performance and reliability monitoring.

---

## Software Engineering Documentation

The following documents have been prepared:

1. Software Requirements Specification (SRS)
2. Software Architecture and Design Specification (SAD)
3. Software Test Plan (STP)

Available project documents are maintained in the `docs/` directory.

---

## Agile Development Methodology

The project follows Agile development practices using GitHub Projects for sprint planning and task management.

### Sprint 1
**Duration:** October 19–25, 2026

Focus:
- User authentication.
- Core task management.
- Task status and priority management.
- Dashboard implementation.
- Initial security features.
- Responsive interface.

### Sprint 2
**Duration:** October 26–November 1, 2026

Focus:
- Advanced task organization.
- Team collaboration.
- Notifications and reminders.
- Reporting and analytics.
- Performance and reliability validation.
- Integration and testing.

---

## GitHub Project Management

GitHub Projects is used to organize development activities.

### Workflow

- **Todo:** Tasks planned but not started.
- **In Progress:** Tasks currently being implemented.
- **Done:** Completed and verified tasks.

Each issue includes:
- User story.
- Functional or non-functional requirement.
- Acceptance criteria.
- Associated test case.
- Priority.
- Story points.
- Sprint assignment.

### Project Repository

https://github.com/Team6-Task-Manager-SE/Task_Manager_Mini_Project

---

## Git Branching Strategy

The repository follows a feature-branch development workflow.

### Main Branches

- `main` — Stable code branch.
- `develop` — Integration branch for ongoing development.

### Supporting Branches

- `feature/*` — New features.
- `bugfix/*` — Bug fixes.
- `chore/*` — Repository maintenance.
- `docs/*` — Documentation updates.

### Pull Request Workflow

1. Create a branch from `develop`.
2. Implement the assigned changes.
3. Commit and push the changes.
4. Create a Pull Request targeting `develop`.
5. Request a code review.
6. Run automated checks.
7. Merge after approval and successful checks.

Both `main` and `develop` have branch protection rules configured.

---

## Continuous Integration

The repository uses GitHub Actions for continuous integration.

### Workflow File

`.github/workflows/ci.yml`

### Current CI Configuration

- Runs on Pull Requests targeting `main` and `develop`.
- Runs on pushes to `main` and `develop`.
- Checks out the repository.
- Verifies the presence of the documentation directory.

Future CI improvements will include:
- Frontend build and tests.
- Backend automated tests.
- Code linting.
- Integration testing.

---

## Testing Strategy

The application will undergo multiple levels of testing.

- Unit Testing
- Integration Testing
- System Testing
- Functional Testing
- Security Testing
- Performance Testing
- User Acceptance Testing

Testing will follow the requirements and test cases documented in the Software Test Plan.

---

## Team Information

**Team:** Team 6

**Institution:** PES University

**Campus:** Electronic City Campus

**Department:** Computer Science and Engineering

**GitHub Organization:**
https://github.com/Team6-Task-Manager-SE

---

## Current Project Status

- SRS completed.
- SAD completed.
- STP completed.
- GitHub organization and repository created.
- GitHub Projects Agile board configured.
- Requirements mapped to GitHub Issues.
- Sprint planning configured.
- Team responsibilities assigned.
- Main and development branches created.
- Branch protection configured.
- Initial GitHub Actions workflow established.
- Application implementation pending.

---

## Local Development

### Prerequisites

- Node.js 20 or newer
- PostgreSQL 16 or compatible
- Redis 7 or compatible

### Start the backend

```bash
cd backend
cp .env.example .env
npm ci
npm run db:migrate
npm start
```

Configure the database, Redis, JWT, and optional SMTP values in `backend/.env`.
If SMTP is not configured, registration confirmation links are printed to the
backend console for local development.

### Start the frontend

```bash
cd frontend
npm ci
npm run dev
```

The frontend runs at `http://127.0.0.1:5173` and proxies `/api` requests to the
backend at `http://127.0.0.1:5000`.

### Authentication API

| Method | Endpoint | Description |
| --- | --- | --- |
| `POST` | `/api/auth/register` | Create an account and send a confirmation link |
| `POST` | `/api/auth/login` | Authenticate and receive a JWT |
| `GET` | `/api/auth/confirm-email?token=...` | Confirm a registered email address |
| `GET` | `/api/auth/me` | Return the authenticated user; requires a bearer token |

Authentication endpoints are limited to 10 requests per IP address per minute.
Five consecutive incorrect passwords lock the account for 15 minutes.

---

## Future Enhancements

- Improved reporting and analytics.
- Enhanced collaboration features.
- Additional automation for task management.
- Improved notification customization.
- Further security and performance optimizations.

---

## License

This project is developed for academic and educational purposes as part of the Software Engineering Mini Project at PES University.
