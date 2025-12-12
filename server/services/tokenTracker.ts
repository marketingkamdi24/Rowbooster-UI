import { storage } from "../storage";
import { InsertTokenUsage } from "@shared/schema";
import { encoding_for_model } from "@dqbd/tiktoken";
import { MonitoringLogger } from "./monitoringLogger";
import { v4 as uuidv4 } from 'uuid';

/**
 * OpenAI API Model Pricing Configuration
 * Prices are in USD per 1 million tokens
 *
 * IMPORTANT: These are the correct prices as per OpenAI API pricing.
 * The model names "gpt-4.1" and "gpt-4.1-mini" are internal aliases.
 *
 * Last updated: 2024-12-03
 */
const PRICING: Record<string, { INPUT_PRICE_PER_MILLION: number; OUTPUT_PRICE_PER_MILLION: number }> = {
  // GPT-4.1 (internal name for GPT-4-turbo equivalent)
  "gpt-4.1": {
    INPUT_PRICE_PER_MILLION: 3.0,    // $3.00 per 1M input tokens
    OUTPUT_PRICE_PER_MILLION: 12.0,  // $12.00 per 1M output tokens
  },
  // GPT-4.1-mini (internal name for GPT-4o-mini equivalent)
  "gpt-4.1-mini": {
    INPUT_PRICE_PER_MILLION: 0.4,    // $0.40 per 1M input tokens
    OUTPUT_PRICE_PER_MILLION: 1.6,   // $1.60 per 1M output tokens
  },
  // GPT-4o (official OpenAI model)
  "gpt-4o": {
    INPUT_PRICE_PER_MILLION: 5.0,    // $5.00 per 1M input tokens
    OUTPUT_PRICE_PER_MILLION: 15.0,  // $15.00 per 1M output tokens
  },
  // GPT-4o-mini (official OpenAI model)
  "gpt-4o-mini": {
    INPUT_PRICE_PER_MILLION: 0.15,   // $0.15 per 1M input tokens
    OUTPUT_PRICE_PER_MILLION: 0.60,  // $0.60 per 1M output tokens
  },
  // GPT-4-turbo (official OpenAI model)
  "gpt-4-turbo": {
    INPUT_PRICE_PER_MILLION: 10.0,   // $10.00 per 1M input tokens
    OUTPUT_PRICE_PER_MILLION: 30.0,  // $30.00 per 1M output tokens
  },
  // GPT-3.5-turbo (official OpenAI model)
  "gpt-3.5-turbo": {
    INPUT_PRICE_PER_MILLION: 0.50,   // $0.50 per 1M input tokens
    OUTPUT_PRICE_PER_MILLION: 1.50,  // $1.50 per 1M output tokens
  },
  // Default fallback pricing (uses gpt-4.1 pricing)
  default: {
    INPUT_PRICE_PER_MILLION: 3.0,
    OUTPUT_PRICE_PER_MILLION: 12.0,
  },
};

/**
 * Token Usage Result with unique API call ID
 */
export interface TokenUsageResult {
  apiCallId: string;
  userId: number | null;
  modelName: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  inputCost: string;
  outputCost: string;
  totalCost: string;
  apiCallType: string;
  timestamp: Date;
}

export class TokenTracker {
  /**
   * Count number of tokens in a given string for the specified model using tiktoken.
   * @param text - The text to count tokens for
   * @param modelName - The model name (e.g., "gpt-4.1")
   * @returns The number of tokens
   */
  static countTokens(text: string, modelName: string = "gpt-4.1"): number {
    try {
      // tiktoken uses "gpt-4" encoding for gpt-4.1 and similar models
      const encodingModel = modelName.startsWith("gpt-4") ? "gpt-4" : modelName;
      const encoder = encoding_for_model(encodingModel as any);
      const tokenIds = encoder.encode(text);
      const count = tokenIds.length;
      encoder.free(); // Important: free the encoder to prevent memory leaks
      return count;
    } catch (error) {
      console.error(`Error counting tokens for model ${modelName}:`, error);
      // Fallback to rough approximation: 1 token ≈ 4 characters for English text
      return Math.ceil(text.length / 4);
    }
  }

  /**
   * Calculate cost in USD given input + output token counts for a specific model.
   * @param modelName - The model used (e.g., "gpt-4.1")
   * @param numInputTokens - Number of input tokens
   * @param numOutputTokens - Number of output tokens
   * @returns Object with inputCost, outputCost, and totalCost
   */
  /**
   * Generate a unique API call ID for tracking individual API requests.
   * Format: apiCallId_timestamp_uuid (e.g., "api_1733234567890_a1b2c3d4")
   */
  static generateApiCallId(): string {
    const timestamp = Date.now();
    const shortUuid = uuidv4().split('-')[0]; // First 8 characters of UUID
    return `api_${timestamp}_${shortUuid}`;
  }

  /**
   * Calculate cost in USD given input + output token counts for a specific model.
   *
   * IMPORTANT: This method uses the correct pricing from the PRICING configuration.
   * All costs are calculated using the actual token counts from the OpenAI API response.
   *
   * @param modelName - The model used (e.g., "gpt-4.1", "gpt-4.1-mini")
   * @param numInputTokens - Number of input (prompt) tokens from API response
   * @param numOutputTokens - Number of output (completion) tokens from API response
   * @returns Object with inputCost, outputCost, and totalCost in USD
   */
  static calculateCost(
    modelName: string,
    numInputTokens: number,
    numOutputTokens: number
  ): { inputCost: string; outputCost: string; totalCost: string } {
    // Normalize model name to lowercase for consistent matching
    const normalizedModelName = modelName.toLowerCase();
    
    // Get pricing for the specific model, fallback to default if not found
    const pricing = PRICING[normalizedModelName] || PRICING[modelName] || PRICING.default;
    
    // Log if using default pricing (helps identify missing model configurations)
    if (!PRICING[normalizedModelName] && !PRICING[modelName]) {
      console.warn(`[TOKEN-TRACKER] Model "${modelName}" not found in pricing config, using default pricing`);
    }

    // Calculate costs based on per-million-token pricing
    const inputCost = (numInputTokens / 1_000_000) * pricing.INPUT_PRICE_PER_MILLION;
    const outputCost = (numOutputTokens / 1_000_000) * pricing.OUTPUT_PRICE_PER_MILLION;
    const totalCost = inputCost + outputCost;

    // Return as strings with 8 decimal precision to avoid floating point issues
    return {
      inputCost: inputCost.toFixed(8),
      outputCost: outputCost.toFixed(8),
      totalCost: totalCost.toFixed(8),
    };
  }

  /**
   * Calculate cost per token (for display purposes)
   */
  static getCostPerToken(modelName: string): { inputCostPerToken: number; outputCostPerToken: number } {
    const pricing = PRICING[modelName.toLowerCase()] || PRICING[modelName] || PRICING.default;
    return {
      inputCostPerToken: pricing.INPUT_PRICE_PER_MILLION / 1_000_000,
      outputCostPerToken: pricing.OUTPUT_PRICE_PER_MILLION / 1_000_000,
    };
  }

  /**
   * Track token usage for OpenAI API calls with per-user tracking and accurate cost calculation.
   * @param userId - The ID of the user making the API call (null for system/anonymous calls)
   * @param modelName - The model used (e.g., "gpt-4.1")
   * @param inputTokens - Number of input tokens
   * @param outputTokens - Number of output tokens
   * @param apiCallType - Type of API call (e.g., "search", "analyze", "extract")
   */
  /**
   * Track token usage for OpenAI API calls with per-user tracking and accurate cost calculation.
   *
   * IMPORTANT: This method reads token counts directly from the OpenAI API response.usage object:
   * - response.usage.prompt_tokens → inputTokens
   * - response.usage.completion_tokens → outputTokens
   * - response.usage.total_tokens → totalTokens (should equal input + output)
   *
   * Each API call is assigned a unique apiCallId for tracking individual requests.
   *
   * @param userId - The ID of the user making the API call (null for system/anonymous calls)
   * @param modelName - The model used (e.g., "gpt-4.1", "gpt-4.1-mini")
   * @param inputTokens - Number of input (prompt) tokens from response.usage.prompt_tokens
   * @param outputTokens - Number of output (completion) tokens from response.usage.completion_tokens
   * @param apiCallType - Type of API call (e.g., "search", "analyze", "extract")
   * @returns TokenUsageResult with apiCallId and all tracking details
   */
  static async trackOpenAIUsage(
    userId: number | null,
    modelName: string,
    inputTokens: number,
    outputTokens: number,
    apiCallType: string
  ): Promise<TokenUsageResult | null> {
    try {
      // Generate unique API call ID for this request
      const apiCallId = this.generateApiCallId();
      const timestamp = new Date();
      
      // Calculate costs using correct pricing
      const costs = this.calculateCost(modelName, inputTokens, outputTokens);
      const totalTokens = inputTokens + outputTokens;

      const tokenUsage: InsertTokenUsage = {
        apiCallId: apiCallId, // Unique identifier for this API call
        userId: userId,
        modelProvider: "openai",
        modelName: modelName,
        inputTokens: inputTokens,
        outputTokens: outputTokens,
        totalTokens: totalTokens,
        inputCost: costs.inputCost,
        outputCost: costs.outputCost,
        totalCost: costs.totalCost,
        apiCallType: apiCallType,
      };

      await storage.saveTokenUsage(tokenUsage);
      
      // Log to monitoring system if userId is available
      if (userId) {
        // Get username from storage
        const user = await storage.getUser(userId);
        if (user) {
          await MonitoringLogger.logTokenUsage({
            userId: userId,
            username: user.username,
            modelProvider: "openai",
            modelName: modelName,
            inputTokens: inputTokens,
            outputTokens: outputTokens,
            totalTokens: totalTokens,
            inputCost: costs.inputCost,
            outputCost: costs.outputCost,
            totalCost: costs.totalCost,
            apiCallType: apiCallType,
          });
        }
      }
      
      const userInfo = userId ? `user ${userId}` : "system";
      console.log(
        `[TOKEN-TRACKER] ${apiCallId} | ${userInfo} | ${modelName} | ${apiCallType} | ` +
        `${inputTokens} input + ${outputTokens} output = ${totalTokens} total tokens | ` +
        `Cost: $${costs.totalCost} (input: $${costs.inputCost}, output: $${costs.outputCost})`
      );

      // Return the result with API call ID for caller reference
      return {
        apiCallId,
        userId,
        modelName,
        inputTokens,
        outputTokens,
        totalTokens,
        inputCost: costs.inputCost,
        outputCost: costs.outputCost,
        totalCost: costs.totalCost,
        apiCallType,
        timestamp,
      };
    } catch (error) {
      console.error("[TOKEN-TRACKER] Failed to track token usage:", error);
      // Don't throw error to avoid breaking the main functionality
      return null;
    }
  }

  /**
   * Track token usage with automatic token counting from text.
   * This method counts tokens from the actual text rather than relying on API response.
   * @param userId - The ID of the user making the API call
   * @param modelName - The model used
   * @param inputText - The input text/prompt
   * @param outputText - The output text/response
   * @param apiCallType - Type of API call
   */
  static async trackOpenAIUsageFromText(
    userId: number | null,
    modelName: string,
    inputText: string,
    outputText: string,
    apiCallType: string
  ): Promise<void> {
    try {
      const inputTokens = this.countTokens(inputText, modelName);
      const outputTokens = this.countTokens(outputText, modelName);
      
      await this.trackOpenAIUsage(userId, modelName, inputTokens, outputTokens, apiCallType);
    } catch (error) {
      console.error("[TOKEN-TRACKER] Failed to track token usage from text:", error);
    }
  }

  /**
   * Estimate token count for text (rough approximation).
   * This is a fallback for when tiktoken is not available.
   * @deprecated Use countTokens() instead for accurate counting
   */
  static estimateTokenCount(text: string): number {
    // Rough approximation: 1 token ≈ 4 characters for English text
    return Math.ceil(text.length / 4);
  }

  /**
   * Get pricing information for a specific model.
   * @param modelName - The model name
   * @returns Pricing object with input and output prices per million tokens
   */
  static getPricing(modelName: string): { INPUT_PRICE_PER_MILLION: number; OUTPUT_PRICE_PER_MILLION: number } {
    return PRICING[modelName.toLowerCase()] || PRICING[modelName] || PRICING.default;
  }

  /**
   * Get all supported models with their pricing.
   * Useful for displaying pricing information in the UI.
   */
  static getAllModelPricing(): Record<string, { INPUT_PRICE_PER_MILLION: number; OUTPUT_PRICE_PER_MILLION: number }> {
    // Return all models except 'default'
    const { default: _, ...models } = PRICING;
    return models;
  }

  /**
   * Validate that a model name is supported and has pricing configured.
   */
  static isModelSupported(modelName: string): boolean {
    const normalized = modelName.toLowerCase();
    return normalized in PRICING || modelName in PRICING;
  }

  /**
   * Helper to verify token counts from API response.
   * OpenAI API returns: prompt_tokens, completion_tokens, total_tokens
   * This validates that total_tokens = prompt_tokens + completion_tokens
   */
  static validateTokenCounts(promptTokens: number, completionTokens: number, totalTokens: number): boolean {
    const calculatedTotal = promptTokens + completionTokens;
    if (calculatedTotal !== totalTokens) {
      console.warn(
        `[TOKEN-TRACKER] Token count mismatch: ${promptTokens} + ${completionTokens} = ${calculatedTotal}, but API reported ${totalTokens}`
      );
      return false;
    }
    return true;
  }
}