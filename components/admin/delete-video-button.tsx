"use client";

import { useFormStatus } from "react-dom";
import { deleteVideoAction } from "@/app/admin/actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return <button className="danger-btn" type="submit" disabled={pending}>{pending ? "Deleting..." : "Delete"}</button>;
}

export function DeleteVideoButton({ id, title }: { id: string; title: string }) {
  return (
    <form className="inline-form" action={deleteVideoAction} onSubmit={(event) => {
      if (!window.confirm(`Permanently delete "${title}", its uploaded video and thumbnail, including stored versions? This cannot be undone.`)) event.preventDefault();
    }}>
      <input type="hidden" name="id" value={id} />
      <SubmitButton />
    </form>
  );
}
