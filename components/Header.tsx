// @ts-nocheck
'use client'
import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname, useRouter } from 'next/navigation'
import { Button } from "@/components/ui/button"
import { Menu, Coins, Leaf, Search, Bell, User, ChevronDown, LogIn, LogOut } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"
import { useMediaQuery } from "@/hooks/useMediaQuery"
import { createUser, getHeaderData, markNotificationAsRead } from "@/utils/db/action"
import { cachedCall } from "@/hooks/useClientCache"
import { createClient } from "@/lib/supabase/client"
import { toast } from "react-hot-toast"
import { Input } from "@/components/ui/input"
import Image from "next/image"

type AuthUserInfo = {
  email: string | null;
  name: string | null;
};

// Map a Supabase Auth user to the shape the header needs (email is the app
// identity) plus a display name.
function mapAuthUser(user: any): AuthUserInfo | null {
  if (!user) return null;
  const name =
    user.user_metadata?.full_name ??
    user.user_metadata?.name ??
    user.email ??
    null;
  return { email: user.email ?? null, name };
}

interface HeaderProps {
  onMenuClick?: () => void;
  totalEarnings?: number;
}

export default function Header({
  onMenuClick = () => undefined,
  totalEarnings = 0,
}: HeaderProps) {
  const [loggedIn, setLoggedIn] = useState(false);
  const [loading, setLoading] = useState(false);
  const [userInfo, setUserInfo] = useState<AuthUserInfo | null>(null);
  const pathname = usePathname()
  const router = useRouter()
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const isMobile = useMediaQuery("(max-width: 768px)")
  const [balance, setBalance] = useState(0)
  const [showLogin, setShowLogin] = useState(false);
  const [loginEmail, setLoginEmail] = useState("");
  const [sendingLink, setSendingLink] = useState(false);

  // Pre-warm the router and prefetch every nav target so the first click
  // doesn't pay the cost of lazy-loading the router + RSC POST + page bundle.
  useEffect(() => {
    const warm = () => {
      const targets = ['/', '/report', '/collect', '/rewards', '/calculator']
      for (const href of targets) {
        try { router.prefetch(href) } catch (e) { /* noop */ }
      }
    }
    if (typeof window === 'undefined') return
    if ('requestIdleCallback' in window) {
      (window as any).requestIdleCallback(warm, { timeout: 2000 })
    } else {
      setTimeout(warm, 0)
    }
  }, [router])

  useEffect(() => {
    if (typeof window === 'undefined') return;

    let supabase: ReturnType<typeof createClient> | null = null;
    try {
      supabase = createClient();
    } catch (error) {
      console.warn("Supabase is not configured. Login will be unavailable.");
      return;
    }

    let mounted = true;

    const applySessionUser = (user: any) => {
      if (!mounted) return;
      const info = mapAuthUser(user);
      if (info?.email) {
        setLoggedIn(true);
        setUserInfo(info);
        // Ensure the application user row exists (idempotent in action.ts).
        try {
          createUser(info.email, info.name || 'Anonymous User');
        } catch (error) {
          console.error("Error creating user:", error);
        }
      } else {
        setLoggedIn(false);
        setUserInfo(null);
      }
    };

    // Establish the initial session (also exchanges the magic-link code after
    // an email OTP redirect and restores the session after a page refresh).
    supabase.auth.getSession().then(({ data: { session } }) => {
      applySessionUser(session?.user ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        applySessionUser(session?.user ?? null);
      },
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!userInfo?.email) return;

    const fetchNotifications = async () => {
      const headerData = await cachedCall(
        `headerData:${userInfo.email}`,
        () => getHeaderData(userInfo.email),
        30_000,
      );
      if (headerData) {
        setNotifications(headerData.notifications);
        setBalance(headerData.balance);
      }
    };

    // Defer the first poll so it never blocks initial render / navigation.
    let intervalId: ReturnType<typeof setInterval> | null = null;
    let idleId: number | null = null;

    const start = () => {
      fetchNotifications();
      intervalId = setInterval(fetchNotifications, 30000);
    };

    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      idleId = (window as any).requestIdleCallback(start, { timeout: 2000 });
    } else {
      idleId = window.setTimeout(start, 0);
    }

    return () => {
      if (idleId !== null) {
        if (typeof window !== 'undefined' && 'cancelIdleCallback' in window && (window as any).cancelIdleCallback) {
          (window as any).cancelIdleCallback(idleId);
        } else {
          clearTimeout(idleId);
        }
      }
      if (intervalId !== null) clearInterval(intervalId);
    };
  }, [userInfo]);

  useEffect(() => {
    const handleBalanceUpdate = (event: CustomEvent) => {
      setBalance(event.detail);
    };

    window.addEventListener('balanceUpdated', handleBalanceUpdate as EventListener);

    return () => {
      window.removeEventListener('balanceUpdated', handleBalanceUpdate as EventListener);
    };
  }, []);

  const login = () => {
    setShowLogin((prev) => !prev);
  };

  const handleSendLoginLink = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = loginEmail.trim();
    if (!email) return;

    setSendingLink(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: window.location.origin },
      });

      if (error) {
        console.error("Error sending login link:", error);
        toast.error(error.message || "Failed to send login link.");
        return;
      }

      setShowLogin(false);
      setLoginEmail("");
      toast.success("Login link sent! Check your email.");
    } catch (error) {
      console.error("Error sending login link:", error);
      toast.error("Failed to send login link.");
    } finally {
      setSendingLink(false);
    }
  };

  const logout = async () => {
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
    } catch (error) {
      console.error("Error during logout:", error);
    }
    setLoggedIn(false);
    setUserInfo(null);
    // Clean up the legacy local marker in existing browsers.
    localStorage.removeItem('userEmail');
  };

  const getUserInfo = async () => {
    try {
      const supabase = createClient();
      const { data } = await supabase.auth.getUser();
      const info = mapAuthUser(data?.user ?? null);
      if (info?.email) {
        setLoggedIn(true);
        setUserInfo(info);
        try {
          await createUser(info.email, info.name || 'Anonymous User');
        } catch (error) {
          console.error("Error creating user:", error);
        }
      }
    } catch (error) {
      console.error("Error fetching user info:", error);
    }
  };

  const handleNotificationClick = async (notificationId: number) => {
    await markNotificationAsRead(notificationId);
    setNotifications(prevNotifications => 
      prevNotifications.filter(notification => notification.id !== notificationId)
    );
  };

  if (loading) {
    // Render the same header shell so the layout doesn't shift while auth warms up.
    return (
      <header className="bg-white shadow-md sticky top-0 z-50 backdrop-blur-lg border-b border-gray-200">
        <div className="flex items-center justify-between px-4 py-3" style={{ minHeight: '76px' }} />
      </header>
    );
  }

  const navLinks = [
    { href: "/", label: "Home" },
    { href: "/report", label: "Report" },
    { href: "/collect", label: "Collect" },
    { href: "/rewards", label: "Reward" },
    { href: "/calculator", label: "Calculator" },
  ];

  return (
    <header className="bg-white shadow-md sticky top-0 z-50 backdrop-blur-lg border-b border-gray-200">
      <div className="flex items-center justify-between px-4 py-3">
        {/* Logo & Hamburger */}
        <div className="flex items-center transition-transform duration-200 hover:scale-105">
          <Button
            variant="ghost"
            size="icon"
            className="mr-2 lg:hidden"
            onClick={onMenuClick}
          >
            <Menu className="h-6 w-6" />
          </Button>
          <Link href="/" className="flex items-center">
            <Image src="/w.png" alt="logo" width={60} height={60} priority />
            <div className="flex flex-col">
              <span className="font-bold text-lg text-gray-800">
                WasteWise
              </span>
              <span className="text-[10px] text-gray-400 -mt-1">
                AI Waste Management
              </span>
            </div>
          </Link>
        </div>

        {/* Navigation Links */}
        <nav className="hidden md:flex gap-8 text-sm font-medium">
          {navLinks.map((link) => (
            <div
              key={link.href}
              className="transition-transform duration-200 hover:scale-105"
            >
              <Link
                href={link.href}
                prefetch={true}
                className={`${
                  pathname === link.href ? "text-green-600" : "text-gray-700"
                } transition-colors duration-200`}
              >
                {link.label}
              </Link>
            </div>
          ))}
        </nav>

        {/* Right Actions */}
        <div className="flex items-center space-x-2">
          {isMobile && (
            <div>
              <Button variant="ghost" size="icon">
              </Button>
            </div>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="mr-2 relative">
                <Bell className="h-5 w-5" />
                {notifications.length > 0 && (
                  <Badge className="absolute -top-1 -right-1 px-1 min-w-[1.2rem] h-5">
                    {notifications.length}
                  </Badge>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              {notifications.length > 0 ? (
                notifications.map((notification) => (
                  <DropdownMenuItem 
                    key={notification.id}
                    onClick={() => handleNotificationClick(notification.id)}
                  >
                    <div className="flex flex-col">
                      <span className="font-medium">{notification.type}</span>
                      <span className="text-sm text-gray-500">{notification.message}</span>
                    </div>
                  </DropdownMenuItem>
                ))
              ) : (
                <DropdownMenuItem>No new notifications</DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          <div className="mr-2 md:mr-4 flex items-center bg-gray-100 rounded-full px-2 md:px-3 py-1">
            <Coins className="h-4 w-4 md:h-5 md:w-5 mr-1 text-green-500" />
            <span className="font-semibold text-sm md:text-base text-gray-800">
              {balance.toFixed(2)}
            </span>
          </div>
          {!loggedIn ? (
            <Button onClick={login} className="bg-green-600 hover:bg-green-700 text-white text-sm md:text-base">
              Login
              <LogIn className="ml-1 md:ml-2 h-4 w-4 md:h-5 md:w-5" />
            </Button>
          ) : (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="flex items-center">
                  <User className="h-5 w-5 mr-1" />
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={getUserInfo}>
                  {userInfo ? userInfo.name : "Fetch User Info"}
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Link href="/settings">Profile</Link>
                </DropdownMenuItem>
                <DropdownMenuItem>Settings</DropdownMenuItem>
                <DropdownMenuItem onClick={logout}>Sign Out</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {showLogin && (
          <div
            className="fixed inset-0 z-50 flex items-start justify-end p-4 pt-20 sm:pt-24"
            onClick={() => setShowLogin(false)}
          >
            <div
              className="bg-white rounded-lg shadow-xl border border-gray-200 p-5 w-full max-w-sm"
              onClick={(e) => e.stopPropagation()}
            >
              <p className="text-base font-semibold text-gray-800 mb-1">Log in with email</p>
              <p className="text-sm text-gray-500 mb-4">
                We&apos;ll email you a magic link to sign you in.
              </p>
              <form onSubmit={handleSendLoginLink} className="space-y-3">
                <Input
                  type="email"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  autoFocus
                />
                <Button type="submit" className="w-full" disabled={sendingLink}>
                  {sendingLink ? "Sending..." : "Send login link"}
                </Button>
              </form>
            </div>
          </div>
        )}
      </div>
    </header>
  )
}