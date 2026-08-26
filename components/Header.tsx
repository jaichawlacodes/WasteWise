// @ts-nocheck
'use client'
import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname } from 'next/navigation'
import { Button } from "@/components/ui/button"
import { motion } from "framer-motion";
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
import Image from "next/image"

const clientId = process.env.WEB3_AUTH_CLIENT_ID ?? "";

let web3auth: any = null;
let web3AuthLoadPromise: Promise<any> | null = null;

async function loadWeb3Auth() {
  if (web3auth) return web3auth;
  if (!clientId) return null;
  if (web3AuthLoadPromise) return web3AuthLoadPromise;

  web3AuthLoadPromise = Promise.all([
    import("@web3auth/modal"),
    import("@web3auth/base"),
    import("@web3auth/ethereum-provider"),
  ]).then(([modal, base, ethereum]) => {
    const chainConfig = {
      chainNamespace: base.CHAIN_NAMESPACES.EIP155,
      chainId: "0xaa36a7",
      rpcTarget: "https://ethereum-sepolia-rpc.publicnode.com",
      displayName: "Ethereum Sepolia Testnet",
      blockExplorerUrl: "https://sepolia.etherscan.io",
      ticker: "ETH",
      tickerName: "Ethereum",
      logo: "https://cryptologos.cc/logos/ethereum-eth-logo.png",
    };

    const privateKeyProvider = new ethereum.EthereumPrivateKeyProvider({
      config: { chainConfig },
    });

    web3auth = new modal.Web3Auth({
      clientId,
      web3AuthNetwork: base.WEB3AUTH_NETWORK.TESTNET,
      privateKeyProvider,
    });

    return web3auth;
  });

  return web3AuthLoadPromise;
}

interface HeaderProps {
  onMenuClick?: () => void;
  totalEarnings?: number;
}

export default function Header({
  onMenuClick = () => undefined,
  totalEarnings = 0,
}: HeaderProps) {
  const [provider, setProvider] = useState<IProvider | null>(null);
  const [loggedIn, setLoggedIn] = useState(false);
  const [loading, setLoading] = useState(false);
  const [userInfo, setUserInfo] = useState<any>(null);
  const pathname = usePathname()
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const isMobile = useMediaQuery("(max-width: 768px)")
  const [balance, setBalance] = useState(0)

  useEffect(() => {
    if (!localStorage.getItem('userEmail')) return;

    const reconnect = async () => {
      setLoading(true);
      try {
        const auth = await loadWeb3Auth();
        if (!auth) return;
        web3auth = auth;
        await web3auth.initModal();
        setProvider(web3auth.provider);

        if (web3auth.connected) {
          setLoggedIn(true);
          const user = await web3auth.getUserInfo();
          setUserInfo(user);
          if (user.email) {
            localStorage.setItem('userEmail', user.email);
            try {
              await createUser(user.email, user.name || 'Anonymous User');
            } catch (error) {
              console.error("Error creating user:", error);
              // Handle the error appropriately, maybe show a message to the user
            }
          }
        }
      } catch (error) {
        console.error("Error initializing Web3Auth:", error);
      } finally {
        setLoading(false);
      }
    };

    reconnect();
  }, []);

  useEffect(() => {
    const fetchNotifications = async () => {
      if (!userInfo?.email) return;
      const headerData = await getHeaderData(userInfo.email);
      if (headerData) {
        setNotifications(headerData.notifications);
        setBalance(headerData.balance);
      }
    };

    fetchNotifications();

    // Set up periodic checking for new notifications
    const notificationInterval = setInterval(fetchNotifications, 30000); // Check every 30 seconds

    return () => clearInterval(notificationInterval);
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

  const login = async () => {
    const auth = await loadWeb3Auth();
    if (!auth) {
      console.warn("Web3Auth is not configured. Please add WEB3_AUTH_CLIENT_ID.");
      return;
    }
    try {
      await auth.initModal();
      const web3authProvider = await auth.connect();
      setProvider(web3authProvider);
      setLoggedIn(true);
      const user = await auth.getUserInfo();
      setUserInfo(user);
      if (user.email) {
        localStorage.setItem('userEmail', user.email);
        try {
          await createUser(user.email, user.name || 'Anonymous User');
        } catch (error) {
          console.error("Error creating user:", error);
          // Handle the error appropriately, maybe show a message to the user
        }
      }
    } catch (error) {
      console.error("Error during login:", error);
    }
  };

  const logout = async () => {
    if (!web3auth) {
      setLoggedIn(false);
      setUserInfo(null);
      return;
    }
    try {
      await web3auth.logout();
      setProvider(null);
      setLoggedIn(false);
      setUserInfo(null);
      localStorage.removeItem('userEmail');
    } catch (error) {
      console.error("Error during logout:", error);
    }
  };

  const getUserInfo = async () => {
    if (web3auth?.connected) {
      const user = await web3auth.getUserInfo();
      setUserInfo(user);
      if (user.email) {
        localStorage.setItem('userEmail', user.email);
        try {
          await createUser(user.email, user.name || 'Anonymous User');
        } catch (error) {
          console.error("Error creating user:", error);
          // Handle the error appropriately, maybe show a message to the user
        }
      }
    }
  };

  const handleNotificationClick = async (notificationId: number) => {
    await markNotificationAsRead(notificationId);
    setNotifications(prevNotifications => 
      prevNotifications.filter(notification => notification.id !== notificationId)
    );
  };

  if (loading) {
    return <div>Loading Web3Auth...</div>;
  }

  const navLinks = [
    { href: "/", label: "Home" },
    { href: "/report", label: "Report" },
    { href: "/collect", label: "Collect" },
    { href: "/rewards", label: "Reward" },
    { href: "/calculator", label: "Calculator" },
  ];

  return (
    <motion.header
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ type: "spring", stiffness: 70 }}
      className="bg-white shadow-md sticky top-0 z-50 backdrop-blur-lg border-b border-gray-200"
    >
      <div className="flex items-center justify-between px-4 py-3">
        {/* Logo & Hamburger */}
        <motion.div whileHover={{ scale: 1.05 }} className="flex items-center">
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
                Wastify
              </span>
              <span className="text-[10px] text-gray-400 -mt-1">
                CodeManthan
              </span>
            </div>
          </Link>
        </motion.div>

        {/* Navigation Links */}
        <nav className="hidden md:flex gap-8 text-sm font-medium">
          {navLinks.map((link) => (
            <motion.div
              key={link.href}
              whileHover={{ scale: 1.05, color: "#16a34a" }}
            >
              <Link
                href={link.href}
                className={`${
                  pathname === link.href ? "text-green-600" : "text-gray-700"
                } transition-colors duration-200`}
              >
                {link.label}
              </Link>
            </motion.div>
          ))}
        </nav>

        {/* Right Actions */}
        <div className="flex items-center space-x-2">
          {isMobile && (
            <motion.div whileTap={{ scale: 0.9 }}>
              <Button variant="ghost" size="icon">
              </Button>
            </motion.div>
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
      </div>
    </motion.header>
  )
}