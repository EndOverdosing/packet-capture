# Type anything in TARGET and run to delete all json files that contain that string

import os

TARGET = "anything"

for root, _, files in os.walk("."):
    for file in files:
        if not file.endswith(".json"):
            continue

        path = os.path.join(root, file)

        try:
            with open(path, "r", encoding="utf-8") as f:
                content = f.read()

            if TARGET in content:
                os.remove(path)
                print(f"Deleted: {path}")

        except Exception as e:
            print(f"Error checking {path}: {e}")