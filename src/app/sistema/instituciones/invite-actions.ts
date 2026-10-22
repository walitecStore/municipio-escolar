"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { mutationOrigin, verifiedSession } from "@/lib/connected/session";
import { invitationAdmin } from "@/lib/connected/auth-admin";
import { institutionContextSchema } from "@/lib/connected/institutions";
export type InvitationState = {
  error?: string;
  link?: string;
  message?: string;
};
export async function inviteStaffAction(
  _: InvitationState,
  form: FormData,
): Promise<InvitationState> {
  try {
    const config = await mutationOrigin();
    const { client, session } = await verifiedSession();
    if (session.role !== "administrator" || session.aal !== "aal2")
      throw new Error();
    const institution = z.string().uuid().parse(form.get("institution"));
    const email = z
      .email()
      .max(254)
      .parse(
        String(form.get("email") ?? "")
          .trim()
          .toLowerCase(),
      );
    const name = z.string().trim().min(2).max(120).parse(form.get("name"));
    const role = z.enum(["administrator", "committee"]).parse(form.get("role"));
    const context = await client.rpc("list_my_institutions");
    if (
      context.error ||
      !institutionContextSchema
        .parse(context.data)
        .institutions.some((i) => i.id === institution)
    )
      throw new Error();
    const existing = form.get("existing")
      ? z.string().uuid().parse(form.get("existing"))
      : null;
    const admin = invitationAdmin();
    // PostgreSQL verifies institution administrator + AAL2, existing accounts and shared limits.
    const allowed = await client.rpc("authorize_staff_invitation", {
      p_institution: institution,
      p_email: email,
      p_existing: existing,
    });
    if (allowed.error)
      return {
        error:
          "No se pudo autorizar la invitación. Comprueba tus permisos y la migración 009. Si el correo ya tiene cuenta, utiliza Asignar cuenta existente. Límite: 20 invitaciones por hora y colegio.",
      };
    const invitation = await admin.generateLink({
      type: "invite",
      email,
      options: { data: { full_name: name } },
    });
    if (
      invitation.error ||
      !invitation.data.user?.id ||
      !invitation.data.properties?.hashed_token
    )
      return {
        error:
          "No se pudo generar la invitación. El correo puede tener una cuenta existente. No se modificó su contraseña.",
      };
    const user = invitation.data.user.id;
    if (existing && user !== existing) throw new Error();
    const assigned = await client.rpc("assign_institution_staff", {
      p_institution: institution,
      p_user: user,
      p_role: role,
      p_active: true,
    });
    if (assigned.error) {
      // Never delete an Auth account here: another invitation may race for the same email.
      // No link is returned unless the institution assignment succeeded.
      return {
        error:
          "No se asignó el acceso institucional. Revisa tus permisos y vuelve a intentarlo.",
      };
    }
    revalidatePath("/sistema/instituciones");
    return {
      link: `${config.origin}/sistema/invitacion#token_hash=${encodeURIComponent(invitation.data.properties.hashed_token)}`,
      message:
        "Invitación creada. Copia el enlace y entrégalo únicamente a esta persona. Se muestra aquí, no se envía por correo automáticamente.",
    };
  } catch {
    return {
      error:
        "No se pudo crear la invitación. Comprueba MFA, permisos y la configuración privada de invitaciones.",
    };
  }
}
