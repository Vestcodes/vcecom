#!/usr/bin/env bash

# -----------------------------
# CONFIGURATION
# -----------------------------
OWNER="vestcodes"
REPO="vcecom"
PROJECT_NUMBER=1

MILESTONE_TITLE="v1.0.0 - beta"
MILESTONE_DESCRIPTION="Beta milestone for version v1.0.0"

echo "Creating milestone: $MILESTONE_TITLE"

# -----------------------------
# 1. Create milestone
# -----------------------------
MILESTONE_ID=$(gh api \
  -X POST \
  /repos/$OWNER/$REPO/milestones \
  -f title="$MILESTONE_TITLE" \
  -f description="$MILESTONE_DESCRIPTION" \
  --jq '.number'
)

echo "Milestone created with ID: $MILESTONE_ID"

# -----------------------------
# 2. Get all issues from GitHub Project
# -----------------------------
echo "Fetching issues from project: $PROJECT_NUMBER"

ISSUE_NUMBERS=$(gh api graphql -f query='
    query($owner: String!, $repo: String!, $project: Int!) {
      repository(owner: $owner, name: $repo) {
        projectV2(number: $project) {
          items(first: 200) {
            nodes {
              content {
                ... on Issue {
                  number
                }
              }
            }
          }
        }
      }
    }
' -F owner=$OWNER -F repo=$REPO -F project=$PROJECT_NUMBER --jq '.data.repository.projectV2.items.nodes[].content.number'
)

echo "Issues found:"
echo "$ISSUE_NUMBERS"

# -----------------------------
# 3. Assign milestone to each issue
# -----------------------------
echo "Assigning milestone to issues..."

for ISSUE in $ISSUE_NUMBERS; do
  if [ "$ISSUE" != "null" ]; then
    echo "Assigning milestone to issue #$ISSUE"
    gh api \
      -X PATCH \
      /repos/$OWNER/$REPO/issues/$ISSUE \
      -f milestone=$MILESTONE_ID >/dev/null
  fi
done

echo "Done! Milestone assigned to all issues."
