-- ====================================================================
-- BuzzNa D74 Enterprise OS - Unified Retail ERP & Offline POS Terminal
-- Supabase Migration Schema & RLS Security Script
-- ====================================================================

-- 1. CLEAN UP: Drop existing table/views/policies if they exist to start fresh
DROP TRIGGER IF EXISTS trigger_set_timestamp ON public.buzzna_records;
DROP FUNCTION IF EXISTS public.trigger_set_timestamp_func();
DROP TABLE IF EXISTS public.buzzna_records CASCADE;

-- 2. CORE TABLE SETUP: BuzzNa Unified Records Table
-- Handles key-value style dynamic JSON records matching local IndexedDB stores
CREATE TABLE public.buzzna_records (
    id TEXT PRIMARY KEY,
    table_name TEXT NOT NULL,
    tenant_id TEXT NULL,
    data JSONB NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. INDEX OPTIMIZATIONS: High-performance filters for syncing & tenant separation
CREATE INDEX idx_buzzna_records_table ON public.buzzna_records (table_name);
CREATE INDEX idx_buzzna_records_tenant ON public.buzzna_records (tenant_id);
CREATE INDEX idx_buzzna_records_table_tenant ON public.buzzna_records (table_name, tenant_id);

-- 4. TIMESTAMP UPDATE FUNCTION: Maintains real-time syncing integrity
CREATE OR REPLACE FUNCTION public.trigger_set_timestamp_func()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_timestamp
    BEFORE UPDATE ON public.buzzna_records
    FOR EACH ROW
    EXECUTE FUNCTION public.trigger_set_timestamp_func();

-- 5. SECURITY SYSTEM: Enable Row Level Security (RLS)
ALTER TABLE public.buzzna_records ENABLE ROW LEVEL SECURITY;

-- 6. SECURITY POLICIES:
-- Policy A: Grant Service Role client full absolute read/write access (Bypasses RLS automatically, but explicitly defined for safety)
CREATE POLICY "Allow service_role full access" 
    ON public.buzzna_records 
    FOR ALL 
    TO service_role 
    USING (true) 
    WITH CHECK (true);

-- Policy B: Allow anonymous access (anon role) used by proxy API endpoints to read records
CREATE POLICY "Allow anon select access" 
    ON public.buzzna_records 
    FOR SELECT 
    TO anon 
    USING (true);

-- Policy C: Allow anonymous access (anon role) used by proxy API endpoints to insert new records
CREATE POLICY "Allow anon insert access" 
    ON public.buzzna_records 
    FOR INSERT 
    TO anon 
    WITH CHECK (true);

-- Policy D: Allow anonymous access (anon role) used by proxy API endpoints to update records
CREATE POLICY "Allow anon update access" 
    ON public.buzzna_records 
    FOR UPDATE 
    TO anon 
    USING (true)
    WITH CHECK (true);

-- Policy E: Allow anonymous access (anon role) used by proxy API endpoints to delete records
CREATE POLICY "Allow anon delete access" 
    ON public.buzzna_records 
    FOR DELETE 
    TO anon 
    USING (true);

-- 7. REPLICATION: Enable real-time replication if needed for dynamic updates
ALTER publication supabase_realtime ADD TABLE public.buzzna_records;
