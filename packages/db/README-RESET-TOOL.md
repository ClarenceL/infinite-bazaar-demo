# Instance Reset Tool

The `reset-instance-data.ts` script provides safe, instance-aware data reset capabilities for the Infinite Bazaar database.

## Features

- **Instance-isolated resets**: Reset data for specific instance IDs only
- **Full database wipe**: Reset all instances (complete data wipe)
- **Safety-first design**: Always preview before executing
- **Confirmation prompts**: Prevents accidental data loss
- **Comprehensive reporting**: Shows exactly what was deleted
- **Foreign key aware**: Deletes in correct order to avoid constraint violations

## Tables Handled

The script resets all tables that contain `instance_id` columns:

- `entities` - Agent entities and their metadata
- `chats` - Chat rooms and conversations  
- `entity_context` - LLM messages and tool interactions
- `x402_endpoints` - Agent-created service endpoints
- `x402_service_calls` - Service usage and payment records
- `agent_relationships` - Inter-agent relationship data
- `context_summaries` - Context summarization data

## Usage

### View Help
```bash
pnpm --filter @infinite-bazaar-demo/db db:reset-instance --help
```

### Preview Operations (ALWAYS RUN FIRST)
```bash
# Preview what would be deleted for a specific instance
pnpm --filter @infinite-bazaar-demo/db db:reset-instance --instance=default --preview

# Preview what would be deleted for ALL instances
pnpm --filter @infinite-bazaar-demo/db db:reset-instance --all-instances --preview
```

### Execute Resets
```bash
# Reset specific instance (with confirmation prompt)
pnpm --filter @infinite-bazaar-demo/db db:reset-instance --instance=default

# Reset specific instance (skip confirmation)
pnpm --filter @infinite-bazaar-demo/db db:reset-instance --instance=default --force

# Reset ALL instances (with confirmation prompt)
pnpm --filter @infinite-bazaar-demo/db db:reset-instance --all-instances

# Reset ALL instances (skip confirmation) - DANGEROUS!
pnpm --filter @infinite-bazaar-demo/db db:reset-instance --all-instances --force
```

## Safety Guidelines

1. **ALWAYS run with `--preview` first** to see what will be deleted
2. **Never run `--all-instances --force`** in production
3. **Backup important data** before running resets
4. **Verify instance names** before executing
5. **Use specific instance IDs** when possible to limit scope

## Examples

### Safe Development Reset
```bash
# 1. First, see what's in the database
pnpm --filter @infinite-bazaar-demo/db db:reset-instance --instance=default --preview

# 2. If you're sure, reset just the default instance
pnpm --filter @infinite-bazaar-demo/db db:reset-instance --instance=default
```

### Testing Environment Cleanup
```bash
# Reset test instance for clean testing
pnpm --filter @infinite-bazaar-demo/db db:reset-instance --instance=test123 --force
```

### Full Development Reset
```bash
# Complete wipe for fresh start (BE CAREFUL!)
pnpm --filter @infinite-bazaar-demo/db db:reset-instance --all-instances
```

## Output Examples

### Preview Output
```
📍 Available instances:
  - default
  - test123

🔍 Analyzing data for instance "default"...

📊 PREVIEW: Data that would be deleted
=====================================
Instance: default

Records per table:
  🗑️  entities: 10 records
  🗑️  chats: 1 records  
  🗑️  entity_context: 91 records
  ✅ x402_endpoints: 0 records (nothing to delete)

Total records to delete: 102
```

### Execution Output
```
🔄 Executing reset operation...
  🗑️  Deleting from context_summaries...
     ✅ Deleted 0 records
  🗑️  Deleting from x402_service_calls...
     ✅ Deleted 0 records
  🗑️  Deleting from entity_context...
     ✅ Deleted 91 records
  🗑️  Deleting from chats...
     ✅ Deleted 1 records
  🗑️  Deleting from entities...
     ✅ Deleted 10 records

📋 RESET SUMMARY
================
Instance: default
Total records deleted: 102

🎉 Reset completed successfully - all target data deleted!
```

## Error Handling

The script includes comprehensive error handling:

- **Invalid arguments**: Clear error messages and usage help
- **Database connection issues**: Graceful error reporting
- **Table access problems**: Warnings for inaccessible tables
- **Foreign key constraints**: Proper deletion order prevents issues

## Integration with Existing Tools

This tool complements the existing `reset-entities.ts` script:

- **`reset-entities.ts`**: Resets entity fields but preserves records
- **`reset-instance-data.ts`**: Completely deletes records for instance isolation

Choose the appropriate tool based on your needs:
- Use `reset-entities.ts` for soft resets that preserve agent records
- Use `reset-instance-data.ts` for hard resets that completely remove data 