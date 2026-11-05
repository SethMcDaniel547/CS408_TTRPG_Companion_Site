"use strict";

// Runs once after the integration suite. The container is torn down separately
// (npm run db:test:down / the ci script), so there is nothing persistent to
// clean up here; this hook exists as the documented place to add teardown if
// the setup ever allocates process-wide resources.
module.exports = async function globalTeardown() {
  // No-op: each test file ends its own pool; the Docker volume is tmpfs.
};
