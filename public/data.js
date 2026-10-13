// Site content. Collections, services, offers and blog posts are read straight from here.
//
// PRODUCTS and REVIEWS are only the starting data: the server copies them into its database
// the first time it runs, and after that products are managed from the admin panel. They are
// also what the pages fall back to if the server cannot be reached.
// `price` is for the 100 ml bottle; the 150 ml price is worked out from it.

const COLLECTIONS = [
    { id: 'designer-delights', name: 'Designer Delights Collection', image: 'col-designer-delights.jpg' },
    { id: 'travel-essentials', name: 'Travel Essentials Collection', image: 'col-travel-essentials.jpg' },
    { id: 'special-occasions', name: 'Special Occasions Collection', image: 'col-special-occasions.jpg' },
    { id: 'seasonal-sensations', name: 'Seasonal Sensations Collection', image: 'col-seasonal-sensations.jpg' },
    { id: 'vintage-treasures', name: 'Vintage Treasures Collection', image: 'col-vintage-treasures.jpg' },
    { id: 'limited-edition', name: 'Limited Edition Treasures', image: 'col-limited-edition.jpg' },
    { id: 'modern-classics', name: 'Modern Classics Collection', image: 'col-modern-classics.jpg' }
];

const FAMILIES = ['Floral', 'Woody', 'Oriental', 'Fresh'];
const GENDERS = ['Women', 'Men', 'Unisex'];
const OCCASIONS = ['Everyday', 'Evening', 'Gifting', 'Celebration'];

const DEFAULT_NOTES = {
    top: 'Citrus Accord, Sun-kissed Fruits',
    heart: 'Golden Roses, Rare Blooms',
    base: 'Amber, Vanilla, Sandalwood'
};

let PRODUCTS = [
    { id: 'luxurious-elixir-rough', name: 'Luxurious Elixir Rough', price: 220, rating: 4, reviews: 60, image: 'p-luxurious-elixir-rough.jpg', collection: 'vintage-treasures', family: 'Oriental', gender: 'Men', occasion: 'Evening', bestseller: true },
    { id: 'golden-legacy', name: 'The Golden Legacy', price: 160, rating: 4, reviews: 103, image: 'p-golden-legacy.jpg', collection: 'modern-classics', family: 'Woody', gender: 'Unisex', occasion: 'Everyday', bestseller: true },
    { id: 'luxurious-elixir', name: 'Luxurious Elixir', price: 250, rating: 5, reviews: 90, image: 'p-luxurious-elixir.jpg', collection: 'designer-delights', family: 'Oriental', gender: 'Unisex', occasion: 'Gifting', bestseller: true },
    { id: 'luxurious-essence', name: 'Luxurious Essence', price: 260, rating: 4, reviews: 212, image: 'p-luxurious-essence.jpg', collection: 'limited-edition', family: 'Oriental', gender: 'Women', occasion: 'Celebration', bestseller: true },
    { id: 'aurum-aura', name: 'Aurum Aura', price: 200, rating: 4, reviews: 103, image: 'p-aurum-aura.jpg', collection: 'special-occasions', family: 'Floral', gender: 'Women', occasion: 'Celebration' },
    { id: 'gleaming-gilt', name: 'Gleaming Gilt', price: 160, rating: 4, reviews: 103, image: 'p-gleaming-gilt.jpg', collection: 'travel-essentials', family: 'Fresh', gender: 'Unisex', occasion: 'Everyday' },
    { id: 'gilded-elixir-rough', name: 'Gilded Elixir Rough', price: 170, rating: 4, reviews: 103, image: 'p-gilded-elixir-rough.jpg', collection: 'vintage-treasures', family: 'Woody', gender: 'Men', occasion: 'Evening' },
    { id: 'golden-luminary', name: 'Golden Luminary', price: 120, rating: 4, reviews: 103, image: 'p-golden-luminary.jpg', collection: 'seasonal-sensations', family: 'Fresh', gender: 'Women', occasion: 'Everyday' },
    { id: 'decadent-opal', name: 'Decadent Opal', price: 160, rating: 5, reviews: 40, image: 'p-decadent-opal.jpg', collection: 'designer-delights', family: 'Floral', gender: 'Women', occasion: 'Gifting' },
    { id: 'gilded-elixir', name: 'Gilded Elixir', price: 200, rating: 5, reviews: 10, image: 'p-gilded-elixir.jpg', collection: 'limited-edition', family: 'Oriental', gender: 'Men', occasion: 'Celebration' },
    { id: 'glamourous-gilt', name: 'Glamourous Gilt', price: 160, rating: 4.5, reviews: 121, image: 'p-glamourous-gilt.jpg', collection: 'modern-classics', family: 'Woody', gender: 'Unisex', occasion: 'Evening' },
    { id: 'luxury-enigma', name: 'Luxury Enigma', price: 190, rating: 5, reviews: 103, image: 'p-luxury-enigma.jpg', collection: 'special-occasions', family: 'Woody', gender: 'Men', occasion: 'Gifting' },
    { id: 'luxurious-golden-legacy', name: 'Luxurious Golden Legacy', price: 240, rating: 5, reviews: 48, image: 'p-luxurious-golden-legacy.jpg', collection: 'seasonal-sensations', family: 'Floral', gender: 'Unisex', occasion: 'Celebration' }
];

const REVIEWS = [
    { name: 'Jack Smith', date: 'June 03, 2023', text: 'Very lovely fragrance. Would recommend to individuals looking for a combination of sweetness and elegance in perfume. I like floral perfume, and this one is lovely, it\'s not overpowering. Nice, pleasant scent. I am happy with purchase.' },
    { name: 'Ashley', date: 'January 05, 2023', text: 'I like floral perfume, and this one is lovely, it\'s not overpowering. Nice, pleasant scent. I am happy with purchase.' },
    { name: 'Lauri Jess', date: 'October 05, 2022', text: 'I tried a sample and fell in love with this fragrance so I had to buy my first bottle. This fragrance is my treat for me. It helps to create a good mood. During a stressful day really nice to stop a few moments and revisit the scent from my wrists. I really love the fact that it doesn\'t take the air out of the room. Some scents are so overbearing but not this on. Try it you just might really love it.' }
];

const OFFERS = [
    {
        theme: 'aqua',
        headline: 'Limited Time Offer: 20% OFF on Aqua Serenity Perfume!',
        name: 'Aqua Serenity',
        tagline: 'Embrace the Tranquil Tides',
        text: 'Immerse yourself in the calming embrace of Aqua Serenity, a captivating fragrance that evokes the essence of water.',
        image: 'col-limited-edition.jpg'
    },
    {
        theme: 'gold',
        headline: 'Limited Time Offer: 25% OFF on Golden Angel Perfume!',
        name: 'Golden Angel',
        tagline: 'Unleash Your Divine Glow',
        text: 'Indulge in the divine allure of Golden Angel, a fragrance that embodies celestial elegance and radiance.',
        image: 'offer-golden-angel.jpg'
    }
];

const SERVICES = [
    { title: 'Personal Fragrance Consultations', image: 'service-1.jpg', text: 'Choosing the right fragrance can be a deeply personal experience. Our team of knowledgeable fragrance experts is here to guide you through this process. Whether you\'re looking for a signature scent, a gift for a loved one, or need assistance in exploring new fragrance families, our consultants will take the time to understand your preferences and suggest the perfect matches.' },
    { title: 'Custom Fragrance Creation', image: 'service-2.jpg', text: 'Experience the art of bespoke perfumery with our custom fragrance creation service. Work closely with our skilled perfumers to craft a scent that is uniquely yours. From selecting individual notes to blending them into a harmonious symphony, we\'ll help you bring your fragrance vision to life. Whether it\'s a special occasion, a gift for someone dear, or simply a way to indulge in luxury, a custom-created perfume is an unforgettable experience.' },
    { title: 'Scented Gift Selection', image: 'service-3.jpg', text: 'Looking for a meaningful gift that leaves a lasting impression? Our scented gift selection service is designed to help you find the perfect fragrance gift for any occasion. Whether it\'s a birthday, anniversary, or a gesture of appreciation, our experts will assist you in choosing a fragrance that perfectly conveys your sentiments and makes the recipient feel cherished.' },
    { title: 'Fragrance Events and Workshops', image: 'service-4.jpg', text: 'Join us for fragrance-centric events and workshops that celebrate the art of perfumery. Immerse yourself in the captivating world of scents, learn from experts, and discover the nuances of different fragrance families. These events are perfect for fragrance enthusiasts and novices alike, providing a unique opportunity to expand your olfactory knowledge.' },
    { title: 'Eco-friendly Initiatives', image: 'service-5.jpg', text: 'At Local Face, we are committed to sustainability and eco-conscious practices. As part of our services, we offer guidance on selecting environmentally friendly and cruelty-free fragrances. We partner with brands that share our values and are dedicated to making a positive impact on the planet.' },
    { title: 'Online Shopping Convenience', image: 'service-6.jpg', text: 'Explore our carefully curated collection of perfumes from the comfort of your home. Our user-friendly website offers a seamless online shopping experience, complete with detailed product descriptions and customer reviews. You can also reach out to our customer support team for any assistance during your shopping journey.' }
];

// Posts are listed newest first. `body` is the article page content; `home: true` posts
// appear in the "Latest Articles" carousel on the home page.
const POSTS = [
    {
        id: 'signature-scent',
        title: 'Finding Your Signature Scent: A Guide to Perfume Personalities',
        category: 'Fragrance Guides',
        date: 'March 14, 2023',
        image: 'blog-signature.jpg',
        excerpt: 'Embark on a journey of self-discovery as we delve into the concept of perfume personalities. From bold and adventurous to elegant and timeless, there\'s a fragrance that perfectly complements your essence. Let us help you find your signature scent, a fragrant expression of your unique style.',
        body: [
            { text: 'Every person carries a mood, a pace and a way of entering a room. A signature scent is the fragrance that matches it so naturally that people begin to associate it with you.' },
            { heading: 'Start With How You Want to Feel', text: 'Bold and adventurous personalities often reach for spices, leather and oud. Calm, classic tastes tend towards soft florals, musks and clean woods. Notice which notes you return to, and let them guide you.' },
            { heading: 'Wear It Before You Decide', text: 'A fragrance changes over the hours as it settles on your skin. Try it for a full day before choosing, and trust the scent that still feels like you by evening.' }
        ]
    },
    {
        id: 'luxury-perfume-collection',
        title: 'The Art of Curating a Luxury Perfume Collection: A Symphony of Scents and Stories',
        category: 'Perfume Collections',
        date: 'January 5, 2023',
        image: 'blog-collection.jpg',
        home: true,
        author: 'Kiara Smith',
        signoff: 'Happy curating!',
        excerpt: 'A luxury perfume collection is not just an assortment of fragrances; it is a reflection of one\'s taste, personality, and experiences. Each bottle holds a unique olfactory journey, crafted with the finest ingredients and artistic mastery.',
        body: [
            { text: 'Welcome, fragrance aficionados, to an exquisite journey into the captivating world of luxury perfume collections. A symphony of scents awaits as we delve into the art of curating a fragrance collection that reflects your essence, evokes cherished memories, and embraces the finest olfactory masterpieces. Just as a maestro conducts an orchestra, we invite you to become the conductor of your very own perfume symphony.' },
            { heading: 'The Perfume Collection: A Personal Overture', text: 'A perfume collection is more than an assortment of fragrances; it is a reflection of your personality, your life\'s chapters, and the emotions that define you. As you embark on this aromatic voyage, consider what scents resonate with your soul, whisking you away to cherished moments and uncharted dreams. Each fragrance in your collection will tell a unique story, narrated by the notes that gracefully dance upon your skin.' },
            {
                image: 'article-1.jpg',
                side: 'left',
                parts: [
                    { heading: 'The Overture: Discovering Your Signature Scent', text: 'The journey to curating a luxury perfume collection begins with finding your signature scent—the one that feels like an olfactory extension of your being. Take time to explore different fragrance families, from opulent florals to mysterious orientals, to discover the notes that harmonize perfectly with your skin chemistry. This will be the foundation upon which you build your enchanting symphony of scents.' },
                    { heading: 'Commemorating Milestones', text: 'Just as the notes of a melody create beautiful harmonies, certain fragrances can encapsulate significant moments in your life. Whether it\'s a celebration of love, a momentous achievement, or a cherished memory with a loved one, select perfumes that become olfactory milestones. With each spritz, you\'ll be transported back in time, reliving the emotions that weave your life\'s narrative.' }
                ]
            },
            { heading: 'Exploring the Fragrance Palette', text: 'As you continue composing your collection, it\'s essential to explore a diverse fragrance palette. Include scents that embody contrasting moods and evoke emotions ranging from serenity to exuberance. From the freshness of citrusy top notes to the warm embrace of rich base notes, each perfume adds a unique hue to your olfactory canvas.' },
            { heading: 'Embracing Niche Gems', text: 'Just as a symphony benefits from unique instruments, your collection can be enriched by the discovery of niche perfumes and artisanal creations. Venture beyond the mainstream, and explore the creations of master perfumers who pour their heart and soul into crafting distinctive scents. These hidden gems add an air of exclusivity to your olfactory repertoire.' },
            {
                image: 'article-2.jpg',
                side: 'right',
                parts: [
                    { heading: 'Perfume as an Art Form', text: 'Perfume is not merely a product; it is an art form that captivates the senses and transcends time. Take a moment to appreciate the artistry behind each perfume, the skill of the perfumer in blending notes, and the emotions they convey through fragrance. Embrace the poetry in each bottle, and your collection will become an ode to the beauty of scent.' },
                    { heading: 'Displaying Your Symphony of Scents', text: 'The grand finale of your perfume symphony lies in the elegant presentation of your collection. A tastefully curated display showcases the artistry of perfume bottles, transforming your collection into an aesthetic marvel. Whether nestled on a vintage vanity or arranged in a custom-made perfume cabinet, your fragrant ensemble becomes an exquisite visual and olfactory experience.' }
                ]
            },
            { text: 'Dear perfume connoisseurs, may this guide inspire you to embark on a journey of curating a luxury perfume collection that harmonizes with your soul. As you add each new fragrance to your symphony, you\'ll find that your collection becomes more than an assemblage of scents—it becomes a masterpiece of memories, emotions, and the art of perfumery.' }
        ]
    },
    {
        id: 'decoding-fragrance-notes',
        title: 'Decoding Fragrance Notes: Unraveling the Symphony of Scents',
        category: 'Fragrance Guides',
        date: 'December 12, 2022',
        image: 'blog-notes.jpg',
        excerpt: 'Ever wondered how perfumers compose their masterpieces? Unravel the mystery behind fragrance notes — top, middle, and base — and learn how each layer contributes to the overall olfactory experience of a perfume. Get ready to appreciate your favorite scents on a whole new level!',
        body: [
            { text: 'A perfume is composed in layers, much like a piece of music. Each layer appears at a different moment, and together they create the full experience of a fragrance.' },
            { heading: 'Top, Heart and Base', text: 'Top notes are the bright first impression and fade within minutes. Heart notes form the character of the scent and last for hours. Base notes are the deep, lasting trail that stays on skin and fabric.' },
            { heading: 'Reading a Fragrance', text: 'Once you know the three layers, a list of notes becomes a story: how a perfume will open, what it will become, and how it will be remembered.' }
        ]
    },
    {
        id: 'lavender-perfumes',
        title: 'The Soothing Symphony of Lavender Perfumes: Unlocking the Secrets of a Fragrant Elixir',
        category: 'Ingredients',
        date: 'November 20, 2022',
        image: 'blog-lavender.jpg',
        home: true,
        excerpt: 'Lavender, with its enchanting aroma and rich history, has been cherished for centuries as a symbol of relaxation, healing, and timeless beauty. In the world of perfumery, lavender plays a key role in creating captivating fragrances loved by many.',
        body: [
            { text: 'Few ingredients are as instantly recognisable as lavender. Its clean, herbal sweetness has scented homes, linens and skin for centuries.' },
            { heading: 'A Note of Calm', text: 'In perfumery, lavender brings freshness to the opening of a fragrance and a gentle, aromatic calm to its heart. It pairs beautifully with citrus, woods and soft musks.' },
            { heading: 'Classic Yet Modern', text: 'From traditional colognes to contemporary blends, lavender keeps finding new expressions, which is why it remains a favourite of perfumers everywhere.' }
        ]
    },
    {
        id: 'perfumery-history',
        title: 'A Journey Through Time: Unearthing Perfumery\'s Rich History',
        category: 'History',
        date: 'October 8, 2022',
        image: 'blog-history.jpg',
        excerpt: 'In our blog collection, we invite you to embark on a journey through time, where we explore the fascinating history of perfumery. From ancient civilizations to modern-day masterpieces, we unravel the tales of how scents have adorned humanity throughout the ages.',
        body: [
            { text: 'The story of perfume is as old as civilization. Long before glass bottles and atomisers, people burned resins, pressed flowers and blended oils to scent their rituals and their lives.' },
            { heading: 'From Temples to Courts', text: 'Fragrance travelled along trade routes with spices and silk, moving from sacred ceremonies to royal courts, where it became a mark of refinement.' },
            { heading: 'The Modern Bottle', text: 'Today\'s perfumes combine that long tradition with modern craft, yet the purpose is unchanged: to capture a feeling and make it last.' }
        ]
    },
    {
        id: 'rose-perfumes',
        title: 'The Timeless Elegance of Rose Perfumes: Unveiling the Queen of Flowers in Fragrance',
        category: 'Ingredients',
        date: 'September 2, 2022',
        image: 'blog-rose.jpg',
        home: true,
        excerpt: 'Rose, often referred to as the "Queen of Flowers," has held a special place in human culture and history for centuries. Beyond its captivating beauty, this iconic bloom has also inspired perfumers to create some of the most timeless and exquisite fragrances in the world.',
        body: [
            { text: 'No flower has inspired perfumers more than the rose. Its scent can be fresh and dewy, deep and velvety, or rich and honeyed, depending on how it is grown and distilled.' },
            { heading: 'One Flower, Many Faces', text: 'Paired with citrus, rose feels bright and modern. With oud and amber it turns opulent and mysterious. With musk it becomes soft and intimate.' },
            { heading: 'An Enduring Classic', text: 'That versatility is why rose appears in so many of the world\'s most loved fragrances, and why it never goes out of style.' }
        ]
    }
];
