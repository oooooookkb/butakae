"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) router.replace("/");
    });
  }, [router]);

  const handleKakaoLogin = async () => {
    setLoading(true);
    const supabase = createClient();
    const { data } = await supabase.auth.signInWithOAuth({
      provider: "kakao",
      options: {
        scopes: "profile_nickname profile_image",
        redirectTo: `${window.location.origin}/auth/callback`,
        skipBrowserRedirect: true,
      },
    });

    if (data?.url) {
      // Supabase 기본 scope에서 account_email 강제 제거
      const url = new URL(data.url);
      url.searchParams.set("scopes", "profile_nickname profile_image");
      window.location.href = url.toString();
    }
  };

  return (
    <div className="min-h-screen bg-bg flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm flex flex-col items-center">
        {/* Logo */}
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-mint to-sky flex items-center justify-center text-4xl mb-4">
          🙏
        </div>
        <h1 className="text-3xl font-black tracking-tight mb-1">
          부탁<span className="text-mint">해</span>
        </h1>
        <p className="text-brand-sub text-sm text-center mb-10">
          동네 부탁 마켓
          <br />
          누구나 부탁을 올리고, 누구나 해결하고 돈을 번다
        </p>

        {/* Kakao Login */}
        <button
          onClick={handleKakaoLogin}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 bg-[#FEE500] text-[#191919] font-bold text-[15px] py-3.5 rounded-xl hover:brightness-95 active:scale-[0.98] transition-all disabled:opacity-60"
        >
          {loading ? (
            <div className="w-5 h-5 rounded-full border-2 border-[#191919] border-t-transparent animate-spin" />
          ) : (
            <>
              <svg
                width="18"
                height="18"
                viewBox="0 0 18 18"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  fillRule="evenodd"
                  clipRule="evenodd"
                  d="M9 0.5C4.029 0.5 0 3.588 0 7.393C0 9.814 1.559 11.949 3.932 13.186L2.933 16.776C2.845 17.088 3.213 17.335 3.478 17.148L7.774 14.23C8.176 14.268 8.585 14.287 9 14.287C13.971 14.287 18 11.199 18 7.393C18 3.588 13.971 0.5 9 0.5Z"
                  fill="#191919"
                />
              </svg>
              카카오로 시작하기
            </>
          )}
        </button>

        <p className="text-xs text-brand-light mt-6 text-center">
          로그인하면 이용약관 및 개인정보처리방침에 동의합니다
        </p>
      </div>
    </div>
  );
}
