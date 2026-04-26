const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  'https://hqwxfkxizfykrrejuezi.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhxd3hma3hpemZ5a3JyZWp1ZXppIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDcwODE1NiwiZXhwIjoyMDkwMjg0MTU2fQ.Hak2L3x6L2PpzCGbDnulLE5mtnurY81fe6fonRBseBM'
);

// We don't have exec_sql unless defined but we can do a hack via postgrest if we have full admin, or better yet, since I don't want to deal with tables that might not work smoothly if permissions differ, I'll use Prisma or whatever the project uses. Wait, the project uses supabase-js. 
// Can I create a table if I do not have raw SQL access?
// We will just use `schema.sql` or similar, but the user expects me to do it.

async function run() {
  const { error } = await supabase.rpc('exec_sql', {
    query: `CREATE TABLE IF NOT EXISTS competitor_analyses (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      profile_id UUID NOT NULL,
      competitor_name TEXT NOT NULL,
      analysis_text TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(profile_id, competitor_name)
    );`
  });
  console.log(error);
}

run();
