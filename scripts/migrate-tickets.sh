#!/bin/bash

# Migrate markdown tickets to GitHub Issues
# Usage: ./migrate-tickets.sh

PROJECT_NUMBER=1
OWNER="eshaffer321"
REPO="MageKnight"

# Function to extract metadata from ticket
get_priority_label() {
    local file="$1"
    local priority=$(grep -m1 "^\*\*Priority:\*\*" "$file" | sed 's/.*: *//' | tr '[:upper:]' '[:lower:]')
    case "$priority" in
        "critical") echo "P0-critical" ;;
        "high") echo "P1-high" ;;
        "medium") echo "P2-medium" ;;
        "low") echo "P3-low" ;;
        *) echo "P2-medium" ;;  # default
    esac
}

get_complexity_label() {
    local file="$1"
    local complexity=$(grep -m1 "^\*\*Complexity:\*\*" "$file" | sed 's/.*: *//' | tr '[:upper:]' '[:lower:]')
    case "$complexity" in
        "high") echo "complexity:high" ;;
        "low") echo "complexity:low" ;;
        *) echo "" ;;  # no complexity label if medium or unknown
    esac
}

get_type_label() {
    local file="$1"
    local filename=$(basename "$file")

    # Infer type from filename or content
    if grep -qi "bug\|broken\|fix" "$file" | head -5; then
        echo "edge-case"
    elif [[ "$filename" == *"ui"* ]] || [[ "$filename" == *"pixi"* ]]; then
        echo "feature"
    else
        echo "feature"
    fi
}

get_area_labels() {
    local file="$1"
    local affects=$(grep -m1 "^\*\*Affects:\*\*" "$file" | sed 's/.*: *//' | tr '[:upper:]' '[:lower:]')
    local labels=""

    [[ "$affects" == *"combat"* ]] && labels="$labels,area:combat"
    [[ "$affects" == *"card"* ]] && labels="$labels,area:cards"
    [[ "$affects" == *"mana"* ]] && labels="$labels,area:mana"
    [[ "$affects" == *"turn"* ]] && labels="$labels,area:turn"
    [[ "$affects" == *"rest"* ]] && labels="$labels,area:rest"
    [[ "$affects" == *"move"* ]] && labels="$labels,area:movement"
    [[ "$affects" == *"unit"* ]] && labels="$labels,area:units"
    [[ "$affects" == *"site"* ]] && labels="$labels,area:sites"
    [[ "$affects" == *"ui"* ]] || [[ "$affects" == *"client"* ]] && labels="$labels,area:ui"

    # Remove leading comma
    echo "${labels#,}"
}

get_title() {
    local file="$1"
    # Get first line, remove "# Ticket: " or "# " prefix
    head -1 "$file" | sed 's/^# Ticket: //' | sed 's/^# //'
}

# Process each ticket
for ticket in /Users/erickshaffer/code/MageKnight/docs/tickets/*.md; do
    [[ "$ticket" == *"_template.md" ]] && continue

    filename=$(basename "$ticket")
    echo "Processing: $filename"

    title=$(get_title "$ticket")
    priority=$(get_priority_label "$ticket")
    complexity=$(get_complexity_label "$ticket")
    area_labels=$(get_area_labels "$ticket")

    # Build labels string
    labels="$priority"
    [[ -n "$complexity" ]] && labels="$labels,$complexity"
    [[ -n "$area_labels" ]] && labels="$labels,$area_labels"

    # Add link to markdown file at the top of the body
    body="📄 **Spec:** [docs/tickets/$filename](https://github.com/$OWNER/$REPO/blob/main/docs/tickets/$filename)

---

$(cat "$ticket")"

    echo "  Title: $title"
    echo "  Labels: $labels"

    # Create the issue
    issue_url=$(gh issue create \
        --repo "$OWNER/$REPO" \
        --title "$title" \
        --body "$body" \
        --label "$labels" \
        --project "MageKnight Development" \
        2>&1)

    if [[ $? -eq 0 ]]; then
        echo "  Created: $issue_url"

        # Extract issue number and add link back to markdown
        issue_num=$(echo "$issue_url" | grep -o '[0-9]*$')
        if [[ -n "$issue_num" ]]; then
            # Add issue link to top of markdown file
            sed -i '' "1a\\
\\
> **GitHub Issue:** [#$issue_num]($issue_url)
" "$ticket"
        fi
    else
        echo "  ERROR: $issue_url"
    fi

    echo ""
done

echo "Migration complete!"
