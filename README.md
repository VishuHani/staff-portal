# Staff Portal

A comprehensive Staff Availability, Time-Off, and Internal Portal Web Application built with modern web technologies.

## Overview

Staff Portal is a full-featured internal management system designed for multi-location businesses to manage staff availability, time-off requests, and internal communications. Built with a focus on user experience, performance, and scalability.

## Features

### Core Features (v1)

- **Staff Availability Management** - Staff can set and manage their weekly availability
- **Time-Off Workflow** - Complete request and approval system for time-off management
- **Communication Hub** - Channel-based posts and direct messaging
- **Role-Based Access Control** - Granular permission system for different user roles
- **Audit Logging** - Comprehensive tracking of all system actions
- **Responsive Design** - Mobile-first design that works on all devices

### Planned Features (Future Releases)

- AI-powered roster conflict detection
- Auto-roster suggestions
- Conversational AI for policy questions
- Advanced analytics and reporting
- PWA with push notifications

## Tech Stack

### Core Technologies

- **Framework**: [Next.js 14+](https://nextjs.org/) (App Router)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **UI Components**: [shadcn/ui](https://ui.shadcn.com/)
- **Database**: [PostgreSQL](https://www.postgresql.org/) (via Supabase)
- **ORM**: [Prisma](https://www.prisma.io/)
- **Auth**: [Supabase Auth](https://supabase.com/auth)
- **Deployment**: [Vercel](https://vercel.com/)

### Supporting Libraries

- **State Management**: React Query + Zustand
- **Validation**: Zod
- **Forms**: React Hook Form
- **Date Handling**: date-fns
- **Notifications**: Sonner

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- PostgreSQL database (or Supabase account)
- Git

### Installation

1. **Clone the repository**

```bash
git clone https://github.com/VishuHani/staff-portal.git
cd staff-portal
```

2. **Install dependencies**

```bash
npm install
```

3. **Set up environment variables**

```bash
cp .env.example .env.local
```

Edit `.env.local` with your actual credentials:
- Set up a Supabase project at https://supabase.com
- Copy your Supabase URL and keys
- Configure your database connection string

4. **Set up the database**

```bash
# Generate Prisma client
npx prisma generate

# Run migrations (when available)
npx prisma migrate dev
```

5. **Run the development server**

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the application.

## Project Structure

```
staff-portal/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── (auth)/            # Auth routes (login, signup)
│   │   ├── (staff)/           # Staff dashboard routes
│   │   ├── (admin)/           # Admin dashboard routes
│   │   └── api/               # API routes
│   ├── components/            # React components
│   │   ├── ui/               # shadcn/ui base components
│   │   ├── staff/            # Staff-specific components
│   │   └── admin/            # Admin-specific components
│   ├── lib/                   # Business logic layer
│   │   ├── actions/          # Server Actions (mutations)
│   │   ├── queries/          # Data fetching functions
│   │   ├── services/         # Business logic
│   │   ├── rbac/             # Permission checking utilities
│   │   ├── audit/            # Audit logging utilities
│   │   ├── prisma.ts         # Prisma client
│   │   └── supabase.ts       # Supabase client
│   └── types/                 # TypeScript types
├── prisma/
│   └── schema.prisma          # Database schema
├── ProjectPlan/               # Project planning and tracking
│   ├── MasterPlan.md         # Comprehensive project plan
│   └── Progress.md           # Progress tracking
└── .claude/                   # Claude AI agents
```

## Database Schema

The application uses 15 core tables:

**Core Entities**:
- users, roles, permissions, role_permissions, stores

**Features**:
- availability, time_off_requests

**Communication**:
- channels, posts, comments, reactions, conversations, conversation_participants, messages

**System**:
- notifications, audit_logs

See `prisma/schema.prisma` for the complete schema definition.

## Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run format` - Format code with Prettier
- `npx prisma studio` - Open Prisma Studio (database GUI)
- `npx prisma migrate dev` - Create and apply migrations
- `npx prisma generate` - Generate Prisma client

### Code Quality

This project uses:
- **ESLint** for code linting
- **Prettier** for code formatting
- **TypeScript** for type safety
- **Zod** for runtime validation

### Git Workflow

1. Create a feature branch from `main`
2. Make your changes
3. Run linting and formatting
4. Commit with descriptive messages
5. Push and create a pull request

## Deployment

### Deploy to Vercel

1. Push your code to GitHub
2. Import your repository in Vercel
3. Configure environment variables
4. Deploy

Vercel will automatically build and deploy your application.

### Database Setup

For production, set up a Supabase project:

1. Create a new project at https://supabase.com
2. Copy the connection string
3. Add to Vercel environment variables
4. Run migrations: `npx prisma migrate deploy`

## Roadmap

See [ProjectPlan/MasterPlan.md](./ProjectPlan/MasterPlan.md) for the complete 6-8 month development roadmap.

### Current Phase: Month 1-2 - Foundation ⏳

- [x] Project setup
- [x] Database schema design
- [ ] Auth system implementation
- [ ] RBAC middleware
- [ ] Base UI components
- [ ] Layout templates

### Upcoming Phases

- **Month 3**: Core Features - Availability
- **Month 4**: Time-Off Workflow
- **Month 5**: Communication - Posts
- **Month 6**: Communication - Messaging
- **Month 7**: Admin & Polish
- **Month 8**: Testing & Launch

## Contributing

This is a private project. For any questions or suggestions, please contact the project owner.

## License

Private and proprietary. All rights reserved.

## Support

For support, email vishal@example.com or open an issue in the repository.

---

**Built with ❤️ using Next.js and Supabase**
