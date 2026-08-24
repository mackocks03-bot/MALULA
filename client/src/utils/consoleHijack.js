const termsAndPrivacyText = `
Terms and Conditions Privacy Policy
Last Updated August 16 2026 Version 42 NEWHOPE Platform
IMPORTANT NOTICE Please read these Terms and Conditions carefully before using the NEWHOPE platform
By registering accessing or using any part of the platform you acknowledge that you have read understood and agree to be bound by these Terms
1 Introduction and Platform Overview
NEWHOPE is a digital earning and social commerce platform that enables registered users to earn rewards by completing tasks watching videos referring others and participating in community activities.
2 Eligibility and Account Registration
You must be at least 18 years of age to register. Only one account per person is allowed.
3 Account Activation
A one time activation fee is required to unlock earning features.
4 Earning System and Task Completion
Users earn rewards by completing YouTube TikTok Facebook Instagram Twitter Telegram and WhatsApp tasks.
5 Referral and Affiliate Program
We operate a multi level affiliate program that pays commissions for Level 1, Level 2, and Level 3 referrals.
6 Withdrawals and Payment Processing
Withdrawals have minimum thresholds and processing fees and are processed within 24 to 72 hours.
7 Shop Balance and Deposits
Shop balance can be funded via PalmPesa or USSD. Deposits are non-refundable.
8 KYC Verification
Identity verification is required using National ID Passport Student ID Voter ID or Nida/Huduma card.
9 Prohibited Conduct
Account multiplication identity fraud task automation and search manipulation are strictly prohibited.
10 Suspension and Termination
Violations result in permanent account termination and forfeiture of all balances.
11 Privacy Policy
We collect registration data financial data KYC data device data usage data and communication logs. We use your data to improve our services and process transactions. Data sharing is limited to trusted service providers. We do not sell your personal data.
12 Intellectual Property
All content graphics logos icons and software on the platform are owned by NEWHOPE.
13 Disclaimers and Limitation of Liability
NEWHOPE does not guarantee any specific level of income. The platform is provided as is without warranties.
14 Community Guidelines
Users must treat others with respect and avoid hate speech spam or platform defamation.
15 Push Notifications and Communications
By registering you consent to receiving push notifications and in-app messages.
16 Spin and Bonus Features
We offer daily spin wheel games login bonuses chat bonuses and rewards.
17 Challenges and Leaderboards
Weekly challenges pay rewards to top 20 active users on Sundays.
18 Changes to Terms
We reserve the right to revise these terms at any time.
19 Governing Law
Disputes are resolved through informal negotiation or binding arbitration.
20 Third-Party Links
We support integrations with YouTube TikTok Facebook Instagram Telegram WhatsApp PalmPesa and M-Pesa.
21 Force Majeure
We are not liable for delays caused by circumstances beyond our control.
22 Contact and Support
Support channels include in-app chat WhatsApp groups Telegram channels and email.
`;

export function initConsoleHijack() {
    // Split text into individual words
    const words = termsAndPrivacyText
        .trim()
        .split(/\s+/)
        .filter(w => w.length > 0);

    if (words.length === 0) return;

    // Guard to prevent recursion
    let isHandling = false;

    // Save browser's native console APIs
    const originalLog = console.log;
    const originalError = console.error;
    const originalWarn = console.warn;
    const originalInfo = console.info;
    const originalDebug = console.debug;
    const originalClear = console.clear;

    function renderHijackedConsole() {
        if (isHandling) return;
        isHandling = true;

        try {
            // Keep console dynamically clear of other errors or logs
            originalClear.call(console);

            // Print the main title block
            originalLog.call(
                console,
                "%c=== NEWHOPE PLATFORM: TERMS & PRIVACY POLICY ===",
                "color: #E2B63E; font-size: 16px; font-weight: 900; background: #13141F; padding: 10px 20px; border-radius: 8px; border: 1.5px solid #E2B63E; display: inline-block; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 1px;"
            );

            // Output all the terms/privacy words with premium, vibrant, random HSL colors
            const wordsPerLine = 12;
            for (let i = 0; i < words.length; i += wordsPerLine) {
                const chunk = words.slice(i, i + wordsPerLine);
                const formatStr = chunk.map(() => "%c%s").join(" ");
                
                const args = [];
                chunk.forEach((word) => {
                    // Generate vibrant pastel colors that stand out in both light and dark console backgrounds
                    const hue = (word.length * 37 + i) % 360; 
                    const style = `color: hsl(${hue}, 95%, 65%); font-weight: 800; font-size: 13.5px; font-family: 'Segoe UI', system-ui, sans-serif; text-shadow: 1px 1px 2px rgba(0,0,0,0.8);`;
                    args.push(style, word);
                });

                originalLog.call(console, formatStr, ...args);
            }
        } catch (e) {
            // fallback to original log if any error occurs
            originalLog.call(console, "Terms & Privacy load failure:", e);
        } finally {
            isHandling = false;
        }
    }

    // Capture and replace standard console operations
    console.log = renderHijackedConsole;
    console.error = renderHijackedConsole;
    console.warn = renderHijackedConsole;
    console.info = renderHijackedConsole;
    console.debug = renderHijackedConsole;
    console.clear = () => {}; // Prevent other scripts from scrubbing the terms and privacy listing

    // Initial output so it appears immediately upon console load
    renderHijackedConsole();
}
