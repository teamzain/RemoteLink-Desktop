export enum PlanId {
    FREE = 'FREE',
    PRO = 'PRO',
    BUSINESS = 'BUSINESS',
    ENTERPRISE = 'ENTERPRISE',
}

export interface PlanMetadata {
    id: PlanId;
    name: string;
    price: number | 'Custom';
    priceLabel: string;
    description: string;
    maxDevices: number | null;
    maxUsers: number | null;
    features: string[];
    popular?: boolean;
}

export const PLAN_CATALOG: PlanMetadata[] = [
    {
        id: PlanId.FREE,
        name: 'Solo',
        price: 2.46,
        priceLabel: '$2.46 / month',
        description: '1 User | 1 Computer. Perfect for individual power users.',
        maxDevices: 1,
        maxUsers: 1,
        features: [
            'Unlimited Remote Access',
            'Always-ON Remote Access',
            'Unlimited Concurrent Access',
            'High-performance',
            'Robust security',
            'File Transfer',
            'Remote Printing',
            'Whiteboard',
            'Remote Reboot',
            'Multi-to-multi monitor',
            'Session recording',
            'Mic passthrough',
            'Remote Chat (in & out of session)',
            '4:4:4 Color accuracy',
            'Access via web',
            'RDP Connector*',
            '24/7 Email and Chat Support',
        ],
    },
    {
        id: PlanId.PRO,
        name: 'Pro',
        price: 8.29,
        priceLabel: '$8.29 / month',
        description: '1 User | 10 Computers. For professionals managing multiple machines.',
        maxDevices: 10,
        maxUsers: 1,
        popular: true,
        features: [
            'Everything in Solo',
            'Up to 10 computers',
            'Platform Independent (PC, Mac, Linux)',
            'Add and organize users',
        ],
    },
    {
        id: PlanId.BUSINESS,
        name: 'Team',
        price: 24.96,
        priceLabel: '$24.96 / month',
        description: 'Unlimited users | 50 Computers. Ideal for small to mid-sized teams.',
        maxDevices: 50,
        maxUsers: null,
        features: [
            'Everything in Pro',
            'Up to 50 computers',
            'Unlimited users',
            '7-DAY Free trial',
            'Endpoint Cloud Backup*',
            'Active Directory / SSO',
            'Active Directory Sync (IdP Sync)',
            'HelpDesk: On-demand Remote Support',
        ],
    },
    {
        id: PlanId.ENTERPRISE,
        name: 'Enterprise',
        price: 49.96,
        priceLabel: '$49.96 / month',
        description: 'Unlimited users | 100 Computers. Full control for large organizations.',
        maxDevices: 100,
        maxUsers: null,
        features: [
            'Everything in Team',
            'Up to 100 computers',
            'Schedule remote access',
            'Organize computer into groups',
            'Computer Grouping',
            'Deployment tools',
            'Set roles and access permissions',
        ],
    },
];
