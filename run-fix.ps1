Set-Location "C:\Users\Felipe\Documents\clone do projeto\ola-jamal"
$file = Resolve-Path ".\PROMPT_CLAUDE_CODE_FIX_ALL.md"
& claude --dangerously-skip-permissions -p "@$file"
