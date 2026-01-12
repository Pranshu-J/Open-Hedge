import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://usuuxqvmiemdtewziwiu.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVzdXV4cXZtaWVtZHRld3ppd2l1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgwODEzMjAsImV4cCI6MjA4MzY1NzMyMH0.36RnBekgJg6jZqLZctdWiZHUJlPIR1TjK4i6Thd3wFA'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)