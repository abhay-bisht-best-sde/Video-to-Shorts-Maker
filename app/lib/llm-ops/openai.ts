import {ChatOpenAI} from "@langchain/openai"
import { env } from "@/app/config/env"

export const openai_client = new ChatOpenAI({
    model: "gpt-4o-mini",
    temperature: 0.5,
    apiKey: env.OPENAI_API_KEY,
})