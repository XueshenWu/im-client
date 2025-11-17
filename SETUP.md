# Setup Guide - Image Management Application

Complete setup instructions for the Image Management application with PostgreSQL and Drizzle ORM.

## Prerequisites

✅ **Required**:
- [Node.js](https://nodejs.org/) v18+ installed
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running
- Git (for version control)

## Step-by-Step Setup

### 1. Clone the Repository

```bash
git clone <your-repo-url>
cd image-management
```

### 2. Install Root Dependencies

```bash
npm install
```

### 3. Set Up the Server

#### 3.1 Install Server Dependencies

```bash
cd server
npm install
```

#### 3.2 Configure Environment Variables

```bash
# Copy the example environment file
copy .env.example .env

# The default values should work fine for development
# DATABASE_URL=postgresql://imageadmin:imagepass@localhost:5432/imagedb
```

### 4. Start PostgreSQL Database

**Important**: Make sure Docker Desktop is running!

```bash
# From the project root directory
cd ..
docker-compose up -d
```

**Verify it's running**:
```bash
docker-compose ps
```

You should see:
```
NAME              IMAGE               STATUS
image-mgmt-db     postgres:16-alpine  Up
```

**View logs** (if needed):
```bash
docker-compose logs -f postgres
```

### 5. Create Database Tables

```bash
cd server

# Push the Drizzle schema to create all tables
npm run db:push
```

This will create:
- `images` table
- `exif_data` table
- `sync_log` table
- All indexes and relations

### 6. Test Database Connection

```bash
npm test
```

You should see output like:
```
🔍 Testing database connection...

Test 1: Checking database connection...
✅ Connected to database: { ... }

Test 2: Fetching all images...
✅ Found 0 images

Test 3: Fetching image statistics...
✅ Statistics: { totalCount: 0, totalSize: 0, ... }

🎉 All tests passed!
```

### 7. (Optional) Open Drizzle Studio

Explore your database visually:

```bash
npm run db:studio
```

This opens a browser-based database viewer at `https://local.drizzle.studio`

### 8. Set Up the Client (Electron App)

```bash
cd ../client
npm install
```

### 9. Run the Development Environment

**Terminal 1** - API Server (when created):
```bash
cd server
npm run dev
```

**Terminal 2** - Electron App:
```bash
cd client
npm run dev
```

## Project Structure

```
image-management/
├── client/                  # Electron app
│   ├── electron/
│   ├── src/
│   └── package.json
├── server/                  # API server
│   ├── src/
│   │   ├── db/
│   │   │   ├── schema.ts   # Database schema
│   │   │   ├── index.ts    # DB connection
│   │   │   └── queries.ts  # Query functions
│   │   └── test.ts
│   ├── drizzle.config.ts
│   ├── tsconfig.json
│   └── package.json
├── storage/                 # File storage
│   ├── images/
│   └── thumbnails/
├── docker-compose.yml       # PostgreSQL container
└── package.json
```

## Useful Commands

### Docker Commands

```bash
# Start database
docker-compose up -d

# Stop database
docker-compose down

# View logs
docker-compose logs -f postgres

# Stop and remove all data (⚠️ destructive)
docker-compose down -v

# Restart database
docker-compose restart postgres

# Access PostgreSQL CLI
docker-compose exec postgres psql -U imageadmin -d imagedb
```

### Drizzle Commands

```bash
cd server

# Push schema to database (create/update tables)
npm run db:push

# Generate migration files
npm run db:generate

# Run pending migrations
npm run db:migrate

# Open visual database browser
npm run db:studio

# Drop all tables (⚠️ destructive)
npm run db:drop
```

### Development Commands

```bash
# Server
cd server
npm run dev          # Start dev server with hot reload
npm run build        # Build for production
npm run start        # Start production server
npm test             # Test database connection

# Client
cd client
npm run dev          # Start Electron in dev mode
npm run build        # Build Electron app
npm run build:win    # Build for Windows
```

## Troubleshooting

### Docker Issues

**Problem**: `unable to get image 'postgres:16-alpine'`

**Solution**: Make sure Docker Desktop is running. On Windows, check the system tray for the Docker icon.

---

**Problem**: Port 5432 already in use

**Solution**: Change the port in `docker-compose.yml`:
```yaml
ports:
  - "5433:5432"
```

Then update `server/.env`:
```env
DATABASE_URL=postgresql://imageadmin:imagepass@localhost:5433/imagedb
```

---

**Problem**: Permission denied on storage volumes

**Solution**: The storage directories should already exist. If not:
```bash
mkdir -p storage/images storage/thumbnails
```

### Database Issues

**Problem**: Can't connect to database

**Solution**:
1. Check Docker is running: `docker-compose ps`
2. Check credentials in `server/.env`
3. Test connection: `docker-compose exec postgres pg_isready -U imageadmin -d imagedb`

---

**Problem**: Tables not created

**Solution**:
```bash
cd server
npm run db:push
```

---

**Problem**: Database schema out of sync

**Solution**:
```bash
cd server

# Option 1: Push current schema (recommended)
npm run db:push

# Option 2: Reset database (⚠️ deletes all data)
docker-compose down -v
docker-compose up -d
npm run db:push
```

### Node/NPM Issues

**Problem**: Module not found errors

**Solution**:
```bash
# Delete node_modules and reinstall
cd server
rm -rf node_modules package-lock.json
npm install

# Or in client
cd client
rm -rf node_modules package-lock.json
npm install
```

## Next Steps

After completing the setup:

1. ✅ PostgreSQL is running in Docker
2. ✅ Database tables are created
3. ✅ Server dependencies are installed
4. ✅ Client dependencies are installed

You're ready to start development! 🚀

### Recommended Next Steps:

1. **Create the Express API server** ([server/src/index.ts](./server/src/index.ts))
2. **Build upload endpoints** using the query functions
3. **Implement image processing** (Sharp, EXIF extraction)
4. **Create the Electron UI** components
5. **Implement sync functionality**

See [ROADMAP.md](./ROADMAP.md) for the full development plan.

## Database Schema

### Images Table
```typescript
{
  id: number;
  uuid: string;
  filename: string;
  originalName: string;
  filePath: string;
  thumbnailPath: string | null;
  fileSize: number;
  format: 'jpg' | 'jpeg' | 'png' | 'tif' | 'tiff';
  width: number | null;
  height: number | null;
  hash: string;  // SHA-256
  mimeType: string | null;
  isCorrupted: boolean;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}
```

### EXIF Data Table
```typescript
{
  id: number;
  imageId: number;  // FK to images
  cameraMake: string | null;
  cameraModel: string | null;
  lensModel: string | null;
  iso: number | null;
  shutterSpeed: string | null;
  aperture: string | null;
  focalLength: string | null;
  dateTaken: Date | null;
  gpsLatitude: number | null;
  gpsLongitude: number | null;
  gpsAltitude: number | null;
  orientation: number | null;
  metadata: object | null;  // JSONB
  createdAt: Date;
  updatedAt: Date;
}
```

### Sync Log Table
```typescript
{
  id: number;
  operation: 'upload' | 'download' | 'update' | 'delete' | 'conflict';
  imageId: number | null;  // FK to images
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  errorMessage: string | null;
  metadata: object | null;  // JSONB
  createdAt: Date;
  completedAt: Date | null;
}
```

## Environment Variables

### Server (.env)

```env
# Database
DATABASE_URL=postgresql://imageadmin:imagepass@localhost:5432/imagedb

# Server
API_PORT=3000
NODE_ENV=development

# Storage
STORAGE_PATH=../storage
IMAGES_PATH=../storage/images
THUMBNAIL_PATH=../storage/thumbnails

# Image Processing
THUMBNAIL_WIDTH=300
THUMBNAIL_HEIGHT=300
THUMBNAIL_QUALITY=70
```

## Support

- Check [server/README.md](./server/README.md) for detailed server documentation
- Check [ROADMAP.md](./ROADMAP.md) for the development plan
- Check [TECH_STACK.md](./TECH_STACK.md) for technology details

## License

ISC
