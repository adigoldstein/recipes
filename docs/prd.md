# Product Requirement Document (PRD): Bite & Board

## Key Decision Points (To Decide On-the-Go or Before Implementation)

1. **Client UI State Management (Zustand vs. React Context):** Deferred. Start with standard React hooks / Context for local state. If menu selection or shopping list state becomes complex, introduce `Zustand`.
2. **Backend Architecture: Single FastAPI App vs. Split `recipe-service` + `ai-service`:** Decide during Phase 1/3. Start with a single FastAPI backend using modular folders, and split into a dedicated `ai-service` app if/when asynchronous AI processing or heavy dependencies warrant it.
3. **AI LLM Provider (Local Ollama vs. Cloud API):** Deferred. Abstract LLM calls behind a Python `Protocol`/Interface so we can swap between Ollama (`Llama 3`) and Cloud APIs (`Anthropic/OpenAI` via `instructor`) with an environment variable.
4. **Nx Python Plugin:** Decided: `@nxlv/python` with `uv`.

## 1. Executive Summary & Vision

Bite & Board is a modern web application for managing personal recipes, planning event menus, dynamically scaling ingredient portions, and automatically importing messy recipes using AI.

The application is built within an Nx Monorepo prioritizing Clean Architecture, clear separation of UI and business logic (Smart vs. Dumb components), high developer ergonomics, and seamless containerization via Docker.

## 2. High-Level Architecture & Tech Stack

### Tech Stack

- **Monorepo Manager:** Nx (Integrated Workspace)
- **Frontend:** React, Vite, TypeScript, Tailwind CSS, Shadcn/ui, TanStack Query (React Query), Zod.
- **UI State Management:** React Context / Hooks (with room to add Zustand on-the-go if needed).
- **Core Backend:** Python 3.12, FastAPI, Pydantic v2, SQLModel (SQLAlchemy v2), Alembic, Uvicorn, SQLite (Embedded DB).
- **AI Service / Module:** Python, `instructor` / OpenAI SDK / Ollama.
- **DevOps & Infrastructure:** Docker, Multi-stage Dockerfiles, Docker Compose.

### Nx Monorepo Directory Layout

```
bite-and-board/
├── apps/
│   ├── web/                     # React + Vite Application
│   ├── recipe-service/          # FastAPI Core Backend (CRUD & Domain Logic)
│   └── ai-service/              # FastAPI AI Worker / Extraction Service (Optional Split)
├── libs/
│   ├── ui-components/           # Shared Dumb / Presentational React Components (Storybook-ready)
│   ├── data-access/             # Shared API Clients, TanStack Query Hooks, Zod Schemas
│   └── shared-types/            # Generated TypeScript types from FastAPI OpenAPI schemas
├── docker/
│   ├── Dockerfile.web
│   ├── Dockerfile.recipe-service
│   └── Dockerfile.ai-service
├── docker-compose.yml
├── nx.json
└── README.md
```

## 3. Component Architecture & State Strategy

### Smart vs. Dumb Component Separation

1. **Dumb / Presentational Components (`libs/ui-components`):**
   - Strict Rule: Zero API calls, zero global/server state knowledge.
   - Pure presentational components receiving data via `props` and triggering callbacks.
   - Examples: `RecipeCard`, `IngredientList`, `PortionSelector`, `SearchBar`, `ModalLayout`.
2. **Smart / Container Components (`apps/web`):**
   - Manage side effects, asynchronous state, API queries, and route states.
   - Pass down processed data to Dumb components.
   - Examples: `RecipeDashboardContainer`, `RecipeDetailsView`, `MenuPlannerContainer`, `AIImporterModal`.

### State Management Separation

- **Server State:** Managed exclusively by TanStack Query (Caching, Invalidation, Optimistic Updates, Error Handling).
- **UI / App State:** Standard React Hooks / Context initially, with an option to adopt Zustand on-the-go if complex client-side state arises (e.g., active event shopping cart).

## 4. Data Models & Database Schema

### `Recipe` (SQLModel / Pydantic)

- `id`: `UUID` / `str` (Primary Key)
- `title`: `str`
- `description`: `Optional[str]`
- `category`: `str` (e.g., Italian, BBQ, Dessert, Bakery)
- `base_servings`: `int` (Default: 4)
- `prep_time_minutes`: `int`
- `cook_time_minutes`: `int`
- `created_at`: `datetime`
- `updated_at`: `datetime`

### `Ingredient` (SQLModel / Pydantic)

- `id`: `UUID` / `str`
- `recipe_id`: `UUID` (Foreign Key to `Recipe`)
- `name`: `str` (e.g., "Flour", "Eggs", "Olive Oil")
- `amount`: `float` (e.g., 500, 2, 15)
- `unit`: `str` (e.g., "grams", "units", "ml", "tbsp")
- `notes`: `Optional[str]`

### `InstructionStep` (SQLModel / Pydantic)

- `id`: `UUID` / `str`
- `recipe_id`: `UUID` (Foreign Key to `Recipe`)
- `step_number`: `int`
- `description`: `str`

## 5. Core Feature Specifications

### 5.1 Dynamic Portion Scaling (Client-Side)

- Execution Location: React Hook / Dumb Component props.
- Calculation:
  - Scaling Ratio = Target Servings / Base Servings
  - Scaled Amount = Base Amount × Scaling Ratio
- All ingredient quantities update dynamically in the UI without re-fetching from the server.

### 5.2 Event Shopping List Consolidation

- Users select multiple recipes for an event menu.
- The application aggregates duplicate ingredients (matching `name` and `unit`) and sums their quantities into a single consolidated shopping list.

### 5.3 AI Recipe Importer

- Trigger: User pastes raw text or a recipe URL into the UI.
- Process: The AI module sends raw input to an LLM enforcing structured output via `instructor` / Pydantic schemas.
- Output: Validated JSON matching `Recipe`, `Ingredient`, and `InstructionStep` schemas.
- Result: Direct ingestion into SQLite via FastAPI.

## 6. Implementation Milestones (BMAD Execution Roadmap)

### Phase 1: Nx Monorepo & Core Backend Setup (MVP-1)

- [ ] Initialize Nx Workspace with `apps/web` (React + Vite) and `apps/recipe-service` (FastAPI).
- [ ] Set up SQLite database with SQLModel and Alembic migrations.
- [ ] Define Pydantic models & SQLModel entities (`Recipe`, `Ingredient`, `InstructionStep`).
- [ ] Implement CRUD endpoints (`GET /recipes`, `GET /recipes/{id}`, `POST /recipes`).
- [ ] Setup OpenAPI TypeScript type generation (`libs/shared-types`).
- [ ] Create initial seed data script (10 realistic recipes).

### Phase 2: Frontend Architecture & UI Features (MVP-2)

- [ ] Create `libs/ui-components` for presentational/dumb UI elements.
- [ ] Build dynamic `PortionSelector` and client-side quantity scaling logic.
- [ ] Build "Event Menu Planner" container and shopping list aggregation logic.
- [ ] Implement client-side form validation using `Zod`.

### Phase 3: AI Service Integration (MVP-3)

- [ ] Establish AI integration layer (either module within `recipe-service` or dedicated `apps/ai-service`).
- [ ] Connect to LLM provider (Ollama or Cloud API) using `instructor`.
- [ ] Create AI Recipe Import modal in React (Raw text -> Structured JSON -> Database save).
- [ ] Implement Smart Ingredient Substitution endpoint.

### Phase 4: Containerization & Deployment

- [ ] Author Dockerfiles for React frontend and FastAPI backend.
- [ ] Configure `docker-compose.yml` for unified local execution with persistent SQLite volumes.
- [ ] (Optional) Deployment target setup (Railway / Render / Cloud server).
