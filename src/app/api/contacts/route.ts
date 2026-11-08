import { handle } from "@/lib/api";
import { inviteContact } from "@/lib/contacts";

export async function POST(request: Request) {
  return handle(async () => {
    const body = await request.json();
    return inviteContact(String(body.customerId ?? ""), {
      name: String(body.name ?? ""),
      relation: String(body.relation ?? ""),
      phone: String(body.phone ?? ""),
    });
  });
}
