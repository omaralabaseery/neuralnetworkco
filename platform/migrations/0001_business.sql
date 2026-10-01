PRAGMA foreign_keys = ON;
CREATE TABLE users (
 id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL COLLATE NOCASE UNIQUE,
 phone TEXT NOT NULL DEFAULT '', company TEXT NOT NULL DEFAULT '', password_hash TEXT NOT NULL,
 role TEXT NOT NULL DEFAULT 'client' CHECK(role IN ('owner','admin','sales','manager','client')),
 active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)), email_verified INTEGER NOT NULL DEFAULT 0,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE sessions (token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,expires_at INTEGER NOT NULL);
CREATE INDEX sessions_user ON sessions(user_id);
CREATE TABLE contacts (
 id TEXT PRIMARY KEY,name TEXT NOT NULL,company TEXT NOT NULL DEFAULT '',email TEXT NOT NULL DEFAULT '',phone TEXT NOT NULL DEFAULT '',
 country TEXT NOT NULL DEFAULT '',source TEXT NOT NULL DEFAULT 'website',marketing_opt_in INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX contacts_email ON contacts(email);
CREATE TABLE requests (
 id TEXT PRIMARY KEY,contact_id TEXT NOT NULL REFERENCES contacts(id),user_id TEXT REFERENCES users(id),
 service TEXT NOT NULL,description TEXT NOT NULL,budget TEXT NOT NULL DEFAULT '',
 status TEXT NOT NULL DEFAULT 'New' CHECK(status IN ('New','Contacted','Qualified','Proposal','Won','Lost')),
 assignee_id TEXT REFERENCES users(id),source TEXT NOT NULL DEFAULT 'website',utm_source TEXT NOT NULL DEFAULT '',utm_medium TEXT NOT NULL DEFAULT '',utm_campaign TEXT NOT NULL DEFAULT '',
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX requests_user ON requests(user_id);
CREATE INDEX requests_status ON requests(status);
CREATE TABLE projects (
 id TEXT PRIMARY KEY,title TEXT NOT NULL,client_id TEXT REFERENCES users(id),request_id TEXT REFERENCES requests(id),
 status TEXT NOT NULL DEFAULT 'Planning' CHECK(status IN ('Planning','Active','Review','Completed','On hold')),
 due_date TEXT NOT NULL DEFAULT '',description TEXT NOT NULL DEFAULT '',created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX projects_client ON projects(client_id);
CREATE TABLE tasks (
 id TEXT PRIMARY KEY,title TEXT NOT NULL,project_id TEXT REFERENCES projects(id),assignee_id TEXT REFERENCES users(id),
 status TEXT NOT NULL DEFAULT 'Todo' CHECK(status IN ('Todo','In progress','Done')),
 priority TEXT NOT NULL DEFAULT 'Medium' CHECK(priority IN ('Low','Medium','High')),due_date TEXT NOT NULL DEFAULT '',created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE notes (id TEXT PRIMARY KEY,request_id TEXT NOT NULL REFERENCES requests(id),author_id TEXT NOT NULL REFERENCES users(id),body TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE audit (id TEXT PRIMARY KEY,actor_id TEXT NOT NULL REFERENCES users(id),action TEXT NOT NULL,entity_id TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE events (id TEXT PRIMARY KEY,visitor_hash TEXT NOT NULL,event TEXT NOT NULL CHECK(event IN ('page_view','service_view','project_start','project_submit','login','register','contact_click')),page TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX events_time ON events(created_at);
CREATE TABLE rate_limits (key TEXT PRIMARY KEY,count INTEGER NOT NULL,expires_at INTEGER NOT NULL);
