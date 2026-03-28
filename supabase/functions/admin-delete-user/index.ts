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

    // Verify caller is admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { data: { user: caller } } = await userClient.auth.getUser(authHeader.replace("Bearer ", ""));
    if (!caller) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Check admin role
    const { data: roleData } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { target_user_id } = await req.json();
    if (!target_user_id) {
      return new Response(JSON.stringify({ error: "target_user_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Don't allow deleting self
    if (target_user_id === caller.id) {
      return new Response(JSON.stringify({ error: "Cannot delete yourself" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Delete user's data in order (respecting foreign keys)
    await adminClient.from("comment_likes").delete().eq("user_id", target_user_id);
    await adminClient.from("bookmarks").delete().eq("user_id", target_user_id);
    await adminClient.from("votes").delete().eq("user_id", target_user_id);
    await adminClient.from("post_downloads").delete().eq("user_id", target_user_id);
    await adminClient.from("follows").delete().or(`follower_id.eq.${target_user_id},following_id.eq.${target_user_id}`);
    await adminClient.from("blocked_users").delete().or(`blocker_id.eq.${target_user_id},blocked_id.eq.${target_user_id}`);
    await adminClient.from("connections").delete().or(`requester_id.eq.${target_user_id},target_id.eq.${target_user_id}`);
    await adminClient.from("notifications").delete().eq("user_id", target_user_id);
    await adminClient.from("user_badges").delete().eq("user_id", target_user_id);
    await adminClient.from("user_roles").delete().eq("user_id", target_user_id);
    await adminClient.from("user_settings").delete().eq("user_id", target_user_id);
    await adminClient.from("reports").delete().eq("reporter_id", target_user_id);

    // Delete messages and conversations
    const { data: convs } = await adminClient
      .from("conversations")
      .select("id")
      .or(`user1_id.eq.${target_user_id},user2_id.eq.${target_user_id}`);
    if (convs && convs.length > 0) {
      const convIds = convs.map((c: any) => c.id);
      await adminClient.from("messages").delete().in("conversation_id", convIds);
      await adminClient.from("conversations").delete().or(`user1_id.eq.${target_user_id},user2_id.eq.${target_user_id}`);
    }

    // Delete comments on user's posts first, then their own comments, then posts
    const { data: userPosts } = await adminClient.from("posts").select("id").eq("user_id", target_user_id);
    if (userPosts && userPosts.length > 0) {
      const postIds = userPosts.map((p: any) => p.id);
      await adminClient.from("comment_likes").delete().in("comment_id",
        (await adminClient.from("comments").select("id").in("post_id", postIds)).data?.map((c: any) => c.id) || []
      );
      await adminClient.from("comments").delete().in("post_id", postIds);
      await adminClient.from("votes").delete().in("post_id", postIds);
      await adminClient.from("bookmarks").delete().in("post_id", postIds);
      await adminClient.from("post_downloads").delete().in("post_id", postIds);
      await adminClient.from("posts").delete().eq("user_id", target_user_id);
    }

    // Delete remaining comments by user
    await adminClient.from("comments").delete().eq("user_id", target_user_id);

    // Delete community/university messages
    await adminClient.from("community_messages").delete().eq("user_id", target_user_id);
    await adminClient.from("university_messages").delete().eq("user_id", target_user_id);

    // Delete moderation data
    await adminClient.from("moderation_queue").delete().eq("user_id", target_user_id);
    await adminClient.from("moderation_logs").delete().eq("user_id", target_user_id);

    // Delete profile
    await adminClient.from("profiles").delete().eq("user_id", target_user_id);

    // Delete auth user
    const { error: authError } = await adminClient.auth.admin.deleteUser(target_user_id);
    if (authError) {
      console.error("Auth delete error:", authError);
      return new Response(JSON.stringify({ error: "Failed to delete auth user: " + authError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Log the action
    await adminClient.from("moderation_logs").insert({
      user_id: caller.id,
      admin_id: caller.id,
      target_user_id: target_user_id,
      action: "delete_user",
      reason: "Admin tarafından silindi",
    });

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Delete user error:", error);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
