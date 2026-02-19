import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://nmvgyxspomshuwiyhysq.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5tdmd5eHNwb21zaHV3aXloeXNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0OTY1MTUsImV4cCI6MjA4NzA3MjUxNX0.4oXJZYBoLovjYfB_JYdEWKJR7EoUoyqnuCQI-gpRCeI'

export const supabase = createClient(supabaseUrl, supabaseKey)
