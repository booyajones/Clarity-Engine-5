import pkg from 'pg';
const { Pool } = pkg;
import { BigQuery } from '@google-cloud/bigquery';
import dotenv from 'dotenv';

dotenv.config();

async function reloadBigQueryData() {
  console.log('🔄 RELOADING BIGQUERY DATA WITH REDUCED DATASET...');
  console.log('================================================');
  
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  
  try {
    // Check current count before clearing
    const beforeCount = await pool.query('SELECT COUNT(*) as count FROM cached_suppliers');
    console.log(`📊 Current suppliers in cache: ${beforeCount.rows[0].count}`);
    console.log('');
    
    // Clear existing cache since dataset has been reduced
    console.log('🧹 Clearing existing cache...');
    await pool.query('TRUNCATE TABLE cached_suppliers');
    console.log('✅ Cache cleared');
    console.log('');
    
    // Initialize BigQuery
    console.log('📡 Connecting to BigQuery...');
    const bigquery = new BigQuery({
      projectId: process.env.BIGQUERY_PROJECT_ID || 'finexiopoc',
      credentials: process.env.BIGQUERY_CREDENTIALS ? 
        JSON.parse(process.env.BIGQUERY_CREDENTIALS) : undefined
    });
    
    // Query for the reduced dataset
    const dataset = process.env.BIGQUERY_DATASET || 'SE_Enrichment';
    const table = process.env.BIGQUERY_TABLE || 'supplier';
    
    const query = `
      WITH distinct_suppliers AS (
        SELECT DISTINCT
          id,
          name,
          payment_type_c,
          ROW_NUMBER() OVER (PARTITION BY LOWER(name) ORDER BY id) as rn
        FROM \`${process.env.BIGQUERY_PROJECT_ID || 'finexiopoc'}.${dataset}.${table}\`
        WHERE COALESCE(is_deleted, false) = false
          AND name IS NOT NULL
          AND LENGTH(TRIM(name)) > 0
      )
      SELECT 
        id as payee_id,
        name as payee_name,
        payment_type_c as payment_method
      FROM distinct_suppliers
      WHERE rn = 1
      ORDER BY name ASC
    `;
    
    console.log('📥 Fetching reduced dataset from BigQuery...');
    const [rows] = await bigquery.query({ query });
    console.log(`✅ Retrieved ${rows.length} suppliers from BigQuery (reduced dataset)`);
    console.log('');
    
    if (rows.length === 0) {
      console.log('⚠️ No data returned from BigQuery. Please check your query and credentials.');
      process.exit(1);
    }
    
    // Insert in batches for better performance
    const batchSize = 1000;
    let inserted = 0;
    
    console.log('📤 Loading suppliers into database...');
    console.log('Progress:');
    
    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);
      
      // Build bulk insert values
      const values = [];
      const placeholders = [];
      let paramIndex = 1;
      
      for (const supplier of batch) {
        placeholders.push(`($${paramIndex}, $${paramIndex+1}, $${paramIndex+2}, $${paramIndex+3})`);
        values.push(
          supplier.payee_id,
          supplier.payee_name,
          supplier.payment_method || null,
          new Date()
        );
        paramIndex += 4;
      }
      
      // Execute bulk insert
      const insertQuery = `
        INSERT INTO cached_suppliers (payee_id, payee_name, payment_method_default, created_at)
        VALUES ${placeholders.join(', ')}
        ON CONFLICT (payee_id) DO UPDATE SET
          payee_name = EXCLUDED.payee_name,
          payment_method_default = EXCLUDED.payment_method_default,
          updated_at = NOW()
      `;
      
      await pool.query(insertQuery, values.flat());
      inserted += batch.length;
      
      // Show progress
      const percentage = Math.round((inserted / rows.length) * 100);
      process.stdout.write(`\r  [${'>'.repeat(Math.floor(percentage/2))}${' '.repeat(50-Math.floor(percentage/2))}] ${percentage}% (${inserted}/${rows.length})`);
    }
    
    console.log('\n');
    console.log('✅ All suppliers loaded successfully');
    console.log('');
    
    // Verify final count
    const finalCount = await pool.query('SELECT COUNT(*) as count FROM cached_suppliers');
    console.log('================================================');
    console.log('📊 RELOAD COMPLETE!');
    console.log(`   Previous count: ${beforeCount.rows[0].count}`);
    console.log(`   New count: ${finalCount.rows[0].count}`);
    console.log(`   Change: ${finalCount.rows[0].count - beforeCount.rows[0].count}`);
    console.log('================================================');
    
    // Create indexes for better performance
    console.log('\n🔨 Creating indexes for optimal performance...');
    
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_cached_suppliers_name 
      ON cached_suppliers(payee_name)
    `);
    
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_cached_suppliers_name_lower 
      ON cached_suppliers(LOWER(payee_name))
    `);
    
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_cached_suppliers_payment_method 
      ON cached_suppliers(payment_method_default)
      WHERE payment_method_default IS NOT NULL
    `);
    
    console.log('✅ Indexes created successfully');
    
  } catch (error) {
    console.error('❌ ERROR:', error.message);
    console.error('Full error:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run the reload
reloadBigQueryData().then(() => {
  console.log('\n✨ BigQuery data reload completed successfully!');
  process.exit(0);
}).catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});