import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify caller identity
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { data: { user } } = await userClient.auth.getUser(authHeader.replace("Bearer ", ""));
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { confirmation } = await req.json();
    if (confirmation !== "DELETE_MY_ACCOUNT") {
      return new Response(JSON.stringify({ error: "Invalid confirmation" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const userId = user.id;
    const userEmail = user.email;

    // Record email in deleted_emails for 3-day cooldown
    if (userEmail) {
      await adminClient.from("deleted_emails").insert({
        email: userEmail.toLowerCase(),
      });
    }

    // Delete user's data in order (same cascade as admin-delete-user)
    await adminClient.from("comment_likes").delete().eq("user_id", userId);
    await adminClient.from("bookmarks").delete().eq("user_id", userId);
    await adminClient.from("votes").delete().eq("user_id", userId);
    await adminClient.from("post_downloads").delete().eq("user_id", userId);
    await adminClient.from("follows").delete().or(`follower_id.eq.${userId},following_id.eq.${userId}`);
    await adminClient.from("blocked_users").delete().or(`blocker_id.eq.${userId},blocked_id.eq.${userId}`);
    await adminClient.from("connections").delete().or(`requester_id.eq.${userId},target_id.eq.${userId}`);
    await adminClient.from("notifications").delete().eq("user_id", userId);
    await adminClient.from("user_badges").delete().eq("user_id", userId);
    await adminClient.from("user_roles").delete().eq("user_id", userId);
    await adminClient.from("user_settings").delete().eq("user_id", userId);
    await adminClient.from("reports").delete().eq("reporter_id", userId);
    await adminClient.from("support_tickets").delete().eq("user_id", userId);
    await adminClient.from("academic_suggestions").delete().eq("user_id", userId);

    // Delete messages and conversations
    const { data: convs } = await adminClient
      .from("conversations")
      .select("id")
      .or(`user1_id.eq.${userId},user2_id.eq.${userId}`);
    if (convs && convs.length > 0) {
      const convIds = convs.map((c: any) => c.id);
      await adminClient.from("messages").delete().in("conversation_id", convIds);
      await adminClient.from("conversations").delete().or(`user1_id.eq.${userId},user2_id.eq.${userId}`);
    }

    // Delete comments on user's posts first, then their own comments, then posts
    const { data: userPosts } = await adminClient.from("posts").select("id").eq("user_id", userId);
    if (userPosts && userPosts.length > 0) {
      const postIds = userPosts.map((p: any) => p.id);
      const { data: postComments } = await adminClient.from("comments").select("id").in("post_id", postIds);
      if (postComments && postComments.length > 0) {
        await adminClient.from("comment_likes").delete().in("comment_id", postComments.map((c: any) => c.id));
      }
      await adminClient.from("comments").delete().in("post_id", postIds);
      await adminClient.from("votes").delete().in("post_id", postIds);
      await adminClient.from("bookmarks").delete().in("post_id", postIds);
      await adminClient.from("post_downloads").delete().in("post_id", postIds);
      await adminClient.from("posts").delete().eq("user_id", userId);
    }

    await adminClient.from("comments").delete().eq("user_id", userId);
    await adminClient.from("community_messages").delete().eq("user_id", userId);
    await adminClient.from("university_messages").delete().eq("user_id", userId);
    await adminClient.from("moderation_queue").delete().eq("user_id", userId);
    await adminClient.from("moderation_logs").delete().eq("user_id", userId);
    await adminClient.from("security_logs").delete().eq("user_id", userId);
    await adminClient.from("login_attempts").delete().eq("email", userEmail || "");

    // Delete storage files
    try {
      const { data: files } = await adminClient.storage.from("uploads").list(`avatars/${userId}`);
      if (files && files.length > 0) {
        await adminClient.storage.from("uploads").remove(files.map(f => `avatars/${userId}/${f.name}`));
      }
      const { data: userFiles } = await adminClient.storage.from("uploads").list(userId);
      if (userFiles && userFiles.length > 0) {
        await adminClient.storage.from("uploads").remove(userFiles.map(f => `${userId}/${f.name}`));
      }
    } catch {}

    // Delete profile
    await adminClient.from("profiles").delete().eq("user_id", userId);

    // Delete auth user
    const { error: authError } = await adminClient.auth.admin.deleteUser(userId);
    if (authError) {
      console.error("Auth delete error:", authError);
      return new Response(JSON.stringify({ error: "Hesap silinemedi: " + authError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Delete account error:", error);
    return new Response(JSON.stringify({ error: "İşlem sırasında bir hata oluştu." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
