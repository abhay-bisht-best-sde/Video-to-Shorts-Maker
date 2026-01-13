export const env = {
    DATABASE_URL:  process.env.DATABASE_URL ,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    TRANSCRIPT_QUEUE : process.env.TRANSCRIPT_QUEUE,
    LLM_ANALYSIS : process.env.LLM_ANALYSIS,
    VIDEO_TRIMMING : process.env.VIDEO_TRIMMING,
    AWS_REGION : process.env.AWS_REGION,
    AWS_ACCESS_KEY_ID : process.env.AWS_ACCESS_KEY_ID,
    AWS_SECRET_ACCESS_KEY : process.env.AWS_SECRET_ACCESS_KEY,
    R2_STORAGE_API: process.env.R2_STORAGE_API,
    R2_BUCKET_NAME: process.env.R2_BUCKET_NAME,
    R2_ACCOUNT_ID: process.env.R2_ACCOUNT_ID,
    R2_ACCESS_ID: process.env.R2_ACCESS_ID,
    R2_SECRET_ACCESS_ID: process.env.R2_SECRET_ACCESS_ID,
    ELEVAN_LABS_API_KEY: process.env.ELEVAN_LABS_API_KEY,
    SB_TRANSCRIPT_BUCKET_NAME: process.env.SB_TRANSCRIPT_BUCKET_NAME,
} 

const requiredEnvs  = [
    "DATABASE_URL",
    "OPENAI_API_KEY",
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "TRANSCRIPT_QUEUE",
    "LLM_ANALYSIS",
    "VIDEO_TRIMMING",
    "AWS_REGION",
    "AWS_ACCESS_KEY_ID",
    "AWS_SECRET_ACCESS_KEY",
    "R2_STORAGE_API",
    "R2_BUCKET_NAME",
    "R2_ACCOUNT_ID",
    "R2_ACCESS_ID",
    "R2_SECRET_ACCESS_ID",
    "ELEVAN_LABS_API_KEY",
    "SB_TRANSCRIPT_BUCKET_NAME"
] as (keyof typeof env)[]

for (const envName of requiredEnvs) {
    if (!env[envName]) {
        throw new Error(`${envName} is not set`);
    }
}