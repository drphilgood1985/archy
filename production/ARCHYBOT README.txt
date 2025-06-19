ARCHYBOT README

Project Overview:
-----------------
ArchyBot is a modular Discord bot designed to archive, retrieve, and analyze support ticket conversations within Discord channels.
It integrates OpenAI for summarization, tagging, and metadata extraction, stores data in a PostgreSQL database, and supports advanced search functionality including semantic search with Pinecone.

Core Features:
--------------
- Archive full Discord channel conversations and media attachments.
- Extract and store structured metadata (staff, sale IDs, tags, quoted revenue).
- Generate summaries and relevant tags via OpenAI API.
- Search tickets by keywords or semantic vector similarity.
- Restore archived conversations to Discord threads.
- Role-based permission control for sensitive commands.
- Ghostbusters command to kill orphaned Node processes.

Key Components:
---------------
1. archiveHandler.mjs
   - Handles the `!archive` command.
   - Coordinates fetching messages, extracting metadata, inserting into the database.
   - Delegates summarization and tagging to commands module.
   - Supports speed mode to bypass confirmations.

2. commands.mjs
   - Manages minor commands like `!summary`, `!retag`, and `!ghostbusters`.
   - Provides glue functions used by archiveHandler.
   - Routes commands other than archive and search.

3. assistantsClient.mjs
   - Wraps OpenAI API calls for summary, tagging, and metadata extraction.
   - Manages rolling memory logs per user for contextual AI responses.

4. sqlClient.mjs
   - Centralized PostgreSQL query helpers.
   - CRUD functions for ticket metadata, messages, and files.
   - Full-text search helpers.

5. searchHandler.mjs
   - Implements advanced search and interactive ticket selection.
   - Supports semantic search via Pinecone and keyword fallback.
   - Provides interactive Q&A and ticket restoration.

6. retrievalHandler.mjs
   - Restores archived ticket logs and files into new Discord threads.

7. Other utilities
   - postToThread.mjs: posts logs and attachments into threads.
   - logger.mjs: file and console logging with rotation.
   - confirmationManager.mjs: natural language confirmation prompts.

Setup and Configuration:
------------------------
- Requires Node.js 18+.
- Requires PostgreSQL database with schema as defined in schema.sql.
- Environment variables must be set (see .env.example):
  - DISCORD_TOKEN: Discord bot token.
  - OPENAI_API_KEY: OpenAI API key.
  - DATABASE_URL: PostgreSQL connection string.
  - ARCHYBOT_MODEL, PARSEBOT_MODEL: OpenAI model names.
- Optional Pinecone API keys for semantic search.

Deployment:
-----------
- Clone the repository.
- Run `npm install` to install dependencies.
- Configure `.env` file with required keys.
- Launch bot via `node index.mjs`.
- Invite bot to your Discord server with appropriate permissions.

Usage:
------
- `!archive` archives current channel conversation and attachments.
- `!archive speed` archives without confirmation prompts.
- `!search <query>` searches tickets by keyword or semantic vector.
- `!summary` generates summary of current channel conversation.
- `!retag` generates tags for current channel conversation.
- `!ghostbusters` kills orphaned Node.js processes running the bot.
- Other commands routed via commands module.

Database Schema:
----------------
- ticket_metadata: stores ticket header info and metadata.
- ticket_messages: stores individual chat messages linked by metadata_id.
- ticket_files: stores media files linked by metadata_id.
- user_memory_logs: stores per-user AI memory context logs.
- user_sessions: tracks user ticket view and activity.

Development Notes:
------------------
- All database operations are encapsulated in sqlClient.mjs.
- OpenAI API interactions centralized in assistantsClient.mjs.
- Commands are modular and routed cleanly from index.mjs.
- Code is ESM modules with async/await patterns.
- Logging implemented with rotation to file and console.
- Error handling is implemented with user feedback in Discord.

Testing:
--------
- Unit test helpers in sqlClient.mjs with mock DB or test DB.
- Mock OpenAI calls for assistantsClient.mjs testing.
- Manual testing in Discord server with test channels.

Future Improvements:
--------------------
- Batch inserts for messages and files for performance.
- Schema cleanup to remove duplicate FK columns if feasible.
- Enhanced search with pagination and improved semantic ranking.
- More detailed user memory and session management.

Support:
--------
- For issues, submit a GitHub issue in the repository.
- Contact the developer team at philipduckett1985@gmail.com.

---

End of README
