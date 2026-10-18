export function ToolbarAlerts({ messages }: { messages: readonly (string | null | false)[] }) {
  return messages.map((message) =>
    message ? (
      <p key={message} role="alert" className="truncate text-destructive">
        {message}
      </p>
    ) : null,
  );
}
