# Transfer To Shared Mac Path

**Implementation note:** `control_mvp.py` and `settings-store.ts` resolve `REPO_ROOT` / cwd at runtime, so absolute paths in this doc are examples; the internal app default project root can be overridden with `MVP_FACTORY_CONTROL_LOCAL_PROJECT_ROOT`.

Use this layout on the target Mac:

```text
/Volumes/Macintosh HD-1/Users/Shared/Projects/
├── mvp-factory-control
├── paperclip
└── checklist
```

## Why this layout

- `mvp-factory-control` already resolves its own repo path dynamically.
- `paperclip` is expected as a sibling directory at `../paperclip`.
- Checklist sync now looks for `.env` in sibling `checklist/.env` and also supports the shared-root path above.
- The LaunchAgent and `Control.app` are installed into the target user account, but they point back to the repo copy in `/Volumes/Macintosh HD-1/Users/Shared/Projects/mvp-factory-control`.

## Target-machine steps

1. Copy the repositories to:
   - `/Volumes/Macintosh HD-1/Users/Shared/Projects/mvp-factory-control`
   - `/Volumes/Macintosh HD-1/Users/Shared/Projects/paperclip`
   - `/Volumes/Macintosh HD-1/Users/Shared/Projects/checklist`
2. Open Terminal and run:

```bash
cd "/Volumes/Macintosh HD-1/Users/Shared/Projects/mvp-factory-control"
export MVP_FACTORY_SHARED_ROOT="/Volumes/Macintosh HD-1/Users/Shared/Projects"
bash scripts/bootstrap.sh
```

3. After bootstrap completes, launch once manually if needed:

```bash
cd "/Volumes/Macintosh HD-1/Users/Shared/Projects/mvp-factory-control"
export MVP_FACTORY_SHARED_ROOT="/Volumes/Macintosh HD-1/Users/Shared/Projects"
bash scripts/launch.sh
```

## Notes

- `MVP_FACTORY_SHARED_ROOT` is optional when the sibling repositories are placed exactly as shown above, but setting it makes the checklist path explicit.
- The installed LaunchAgent file lives in `~/Library/LaunchAgents/com.moldovancsaba.control-mvp.plist`.
- `Control.app` is rebuilt in `/Applications` during bootstrap and will launch the shared-path repo copy.
