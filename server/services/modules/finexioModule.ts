/**
 * Finexio Matching Module
 * 
 * Self-contained module for Finexio supplier matching.
 * Can be executed independently or as part of a pipeline.
 */

import { PipelineModule } from '../pipelineOrchestrator';
import { finexioMatcherV3 } from '../finexioMatcherV3';
import { storage } from '../../storage';

class FinexioModule implements PipelineModule {
  name = 'finexio';
  enabled = true;
  order = 2; // Second in pipeline
  statusField = 'finexioMatchStatus';
  completedField = 'finexioMatchCompletedAt';

  async execute(batchId: number, options: any = {}): Promise<void> {
    console.log(`💼 Finexio Module: Starting for batch ${batchId}`);
    
    try {
      // Update status
      await storage.updateUploadBatch(batchId, {
        finexioMatchingStatus: 'processing',
        currentStep: 'Matching with Finexio suppliers',
        progressMessage: 'Searching Finexio supplier database...'
      });

      // Get classifications for this batch
      const classifications = await storage.getBatchClassifications(batchId);
      
      if (classifications.length === 0) {
        console.log(`⚠️ No classifications found for batch ${batchId}`);
        await storage.updateUploadBatch(batchId, {
          finexioMatchingStatus: 'skipped',
          finexioMatchingCompletedAt: new Date()
        });
        return;
      }

      let matchedCount = 0;
      let processedCount = 0;
      const totalCount = classifications.length;
      
      // Process in chunks to prevent connection pool exhaustion
      const CHUNK_SIZE = 50; // Process 50 at a time
      const chunks = [];
      for (let i = 0; i < classifications.length; i += CHUNK_SIZE) {
        chunks.push(classifications.slice(i, i + CHUNK_SIZE));
      }

      console.log(`📦 Processing ${totalCount} classifications in ${chunks.length} chunks of ${CHUNK_SIZE}`);

      // Process each chunk with limited concurrency
      for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
        const chunk = chunks[chunkIndex];
        const chunkResults = [];
        
        try {
          // Process chunk with V3 streamlined matcher (DB→Rules→AI)
          const CONCURRENT_LIMIT = 20; // Increased to 20 with streamlined V3 matcher
          for (let i = 0; i < chunk.length; i += CONCURRENT_LIMIT) {
            const batch = chunk.slice(i, i + CONCURRENT_LIMIT);
            
            const batchPromises = batch.map(async (classification) => {
              try {
                // Use the new streamlined V3 matcher (DB→Rules→AI)
                const result = await finexioMatcherV3.match(
                  classification.cleanedName || classification.originalName,
                  {
                    city: classification.city,
                    state: classification.state
                  }
                );

                if (result.matched && result.supplierId) {
                  // Update classification with Finexio match
                  await storage.updatePayeeClassification(classification.id, {
                    finexioSupplierId: result.supplierId,
                    finexioSupplierName: classification.cleanedName || classification.originalName,
                    finexioConfidence: result.confidence,
                    finexioMatchReasoning: `${result.method}: ${result.reasoning}` // Combined method and reasoning
                  });
                  return { matched: true };
                }
                return { matched: false };
              } catch (error) {
                console.error(`Error matching payee ${classification.id}:`, error);
                // Return error but don't fail the whole chunk
                return { matched: false, error: true };
              }
            });

            // Wait for this batch to complete before starting the next
            const batchResults = await Promise.all(batchPromises);
            chunkResults.push(...batchResults);
          }
          
          // Count matches
          const chunkMatches = chunkResults.filter(r => r.matched).length;
          matchedCount += chunkMatches;
          processedCount += chunk.length;

          // Update progress after each chunk
          const progress = Math.round((processedCount / totalCount) * 100);
          await storage.updateUploadBatch(batchId, {
            finexioMatchingProgress: progress,
            progressMessage: `Finexio: Matched ${matchedCount}/${processedCount} (${progress}%)...`
          });
          
          console.log(`✅ Chunk ${chunkIndex + 1}/${chunks.length}: ${chunkMatches}/${chunk.length} matched`);
          
          // Small delay between chunks to prevent overwhelming the database
          if (chunkIndex < chunks.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        } catch (error) {
          console.error(`❌ Failed to process chunk ${chunkIndex + 1}:`, error);
          // Continue with next chunk instead of failing completely
        }
      }

      // Update final status
      await storage.updateUploadBatch(batchId, {
        finexioMatchingStatus: 'completed',
        finexioMatchingCompletedAt: new Date(),
        currentStep: 'Finexio matching complete',
        progressMessage: `Matched ${matchedCount}/${processedCount} payees with Finexio suppliers`
      });

      console.log(`✅ Finexio Module: Completed for batch ${batchId} (${matchedCount}/${processedCount} matched)`);
    } catch (error) {
      console.error(`❌ Finexio Module: Failed for batch ${batchId}:`, error);
      
      await storage.updateUploadBatch(batchId, {
        finexioMatchingStatus: 'error',
        currentStep: 'Finexio matching failed',
        progressMessage: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
      
      throw error;
    }
  }
}

export const finexioModule = new FinexioModule();