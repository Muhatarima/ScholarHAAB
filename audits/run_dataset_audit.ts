import { runDatasetAudit } from './dataset/dataset_audit'

runDatasetAudit()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
