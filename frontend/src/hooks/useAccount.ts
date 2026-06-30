import { useEffect, useState } from "react";
import { isConnected, getPublicKey, requestAccess } from "@stellar/freighter-api";

let address: string | null = null;
// Initialize address lookup only on client side
let addressLookup: Promise<string | null> | null = null;

// returning the same object identity every time avoids unnecessary re-renders
const addressObject = {
  address: "",
  displayName: "",
};
const addressToHistoricObject = (addr: string) => {
  addressObject.address = addr;
  addressObject.displayName = `${addr.slice(0, 4)}...${addr.slice(-4)}`;
  return addressObject;
};

/**
 * Returns an object containing `address` and `displayName` properties, with
 * the address fetched from Freighter's `getPublicKey` method in a
 * render-friendly way.
 *
 * Before the address is fetched, returns null.
 *
 * Caches the result so that the Freighter lookup only happens once, no matter
 * how many times this hook is called.
 *
 * NOTE: This does not update the return value if the user changes their
 * Freighter settings; they will need to refresh the page.
 */
export function useAccount(): typeof addressObject | null {
  const [, setLoading] = useState(address === undefined);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (address !== undefined && address !== null) return;
    // Only initialize address lookup on client
    if (!addressLookup) {
      addressLookup = (async () => {
        try {
          const connected = await isConnected();
          if (connected) {
            return await getPublicKey();
          }
          return null;
        } catch (e) {
          console.error("Error checking Freighter connection:", e);
          return null;
        }
      })();
    }
    addressLookup
      .then((addr) => {
        if (addr) address = addr;
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  if (mounted && address) return addressToHistoricObject(address);
  return null;
}

export async function connectFreighter(): Promise<string | null> {
  try {
    const addr = await requestAccess();
    if (addr) {
      address = addr;
      return addr;
    }
    return null;
  } catch (e) {
    console.error("Error connecting Freighter:", e);
    return null;
  }
}
