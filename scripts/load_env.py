#!/usr/bin/env python3
import json
import sys

try:
    from coze_workload_identity import Client
    client = Client()
    env_vars = client.get_project_env_vars()
    client.close()
    result = {}
    for env_var in env_vars:
        if "SUPABASE" in env_var.key:
            result[env_var.key] = env_var.value
    print(json.dumps(result))
    sys.exit(0)
except Exception as e:
    print(json.dumps({"error": str(e)}), file=sys.stderr)
    sys.exit(1)
