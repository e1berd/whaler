-- Remove the auto-seeded `src` directory and `src/main.ts` from existing workspaces.
-- Match the exact seed content/kind to avoid touching files users actually created.

DELETE FROM files
WHERE path = 'src/main.ts'
  AND kind = 'file'
  AND content = E'console.log(''hello from whaler'')\n';

DELETE FROM files
WHERE path = 'src'
  AND kind = 'directory'
  AND content = '';
