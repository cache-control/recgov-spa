'use client';

import { ReactElement } from 'react';
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { Table, TableHeader, TableHead, TableRow, TableBody, TableCell } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

export default function CampgroundSearch() {
    interface DynObj {
        [key: string]: any; // eslint-disable-line @typescript-eslint/no-explicit-any 
    }

    const defaultCamp : DynObj = {
        entity_id: 0,
    };

    const campInfoDefault : DynObj = {
        camp: defaultCamp,
        availableDate: new Date().toISOString().slice(0, 7) + '-01T00%3A00%3A00.000Z',
    };

    const emptyDynObjArray : DynObj[] = [];

    const [ campgrounds, setCampgrounds ] = useState(emptyDynObjArray);
    const [ availableSites, setAvailableSites ] = useState(emptyDynObjArray);
    const [ errorMessage, setErrorMessage ] = useState("");
    const [ campInfo, setCampInfo ] = useState(campInfoDefault);

    const formSchema = z.object({
        keywords: z.string().min(3).max(50),
    });

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            keywords: "",
        },
    });

    async function getAvailableSites() {
        const camp = campInfo.camp;
        const campId = camp.entity_id;
        const start = campInfo.availableDate;
        const cacheKey = `${campId},${start}`;

        if (cacheKey in camp == false) {
            const reservableSites = emptyDynObjArray;
            let payload : DynObj = {};

            try {
                const url = `https://www.recreation.gov/api/camps/availability/campground/${campId}/month?start_date=${start}`;
                const response = await fetch(url);
                payload = await response.json();
            } catch {
                setErrorMessage("Network failure while retrieving campground.");
                return;
            }

            for (const key in payload.campsites) {
                const site = payload.campsites[key];
                let expectedDayAsNum = 0;
                const days : string[] = [];
                let contig : string[] = [];
                const span = [];

                for (const date in site.availabilities) {
                    if (site.availabilities[date] === 'Available') {
                        const day = date.slice(5,10).replace('-','/');
                        const dayAsNum = Number(day.replace('/',''));

                        days.push(day);

                        // group dates into contiguous blocks
                        if (expectedDayAsNum === 0)
                            expectedDayAsNum = dayAsNum;

                        if (expectedDayAsNum === dayAsNum) {
                            contig.push(day);
                            expectedDayAsNum++;
                        } else {
                            span.push(contig);
                            contig = [ day ];
                            expectedDayAsNum = dayAsNum + 1;
                        }

                    }
                }

                if (contig.length)
                    span.push(contig);

                if (days.length) {
                    let spanColor = "";

                    reservableSites.push({
                        site: site.site,
                        loop: site.loop,
                        campsite_id: site.campsite_id,
                        campsite_type: site.campsite_type,
                        days: days.join(","),
                        daysSpan: span.map( (contig,idx) => {
                                spanColor = spanColor.length? "" : "text-blue-800";
                                return <span key={idx} className={spanColor}>{contig.join(",")} </span>
                            } ),
                    });
                }
            }

            camp[cacheKey] = reservableSites.sort( (a,b) => a.days.localeCompare(b.days) );
            setCampgrounds( [ ...campgrounds ] );
        }

        setAvailableSites(camp[cacheKey]);
        setErrorMessage(camp[cacheKey].length>0? "":"No reservable campsites.");
    }

    async function onSubmitSearch(value: z.infer<typeof formSchema>) {
        const url = 'https://www.recreation.gov/api/search?exact=false&size=30&q=' + encodeURI(value.keywords);
        let payload : DynObj = {};

        try {
            const response = await fetch(url);
            payload = await response.json();
        } catch {
            setErrorMessage("Network failure during search.");
            return;
        }

        if ('results' in payload) {
            setErrorMessage("");
            campInfo.camp = defaultCamp;
            setCampInfo( { ...campInfo } );

            setAvailableSites(emptyDynObjArray);
            setCampgrounds( () => payload.results.filter( (camp:DynObj) => camp.reservable && camp.entity_type==="campground") );
        } else {
            setErrorMessage("No matching campgrounds...");
        }
    }

    function onClickSelectCampground(idx: number) {
        campInfo.camp = campgrounds.at(idx);
        setCampInfo( { ...campInfo } );
        setErrorMessage("");
        getAvailableSites();
    }

    function onClickBackToCampgrounds() {
        campInfo.camp = defaultCamp;
        setCampInfo( { ...campInfo } );
        setErrorMessage("");
    }

    function onClickSetDate(date: string) {
        campInfo.availableDate =  date;
        setCampInfo( { ...campInfo } );

        setErrorMessage("");
        getAvailableSites();
    }

    function SearchForm() {
        return (
        <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmitSearch)} className="space-y-8">
                    <FormField control={form.control} name="keywords" render={ ({field}) => (
                        <FormItem>
                            <FormControl>
                                <div className="flex items-center justify-center gap-2">
                                    <Input
                                        onFocus={()=>setErrorMessage("")}
                                        className="w-72 p-4 rounded-lg border border-gray-300 shadow-md"
                                        placeholder="keywords (ex: grand canyon)"
                                        {...field}
                                    />
                                    <Button type="submit" variant="outline">Search</Button>
                                </div>
                            </FormControl>
                            <FormMessage>{errorMessage}</FormMessage>
                        </FormItem>
                    )}>
                    </FormField>
                </form>
        </Form>
        );
    }

    function CampgroundPanel() {
        if (campInfo.camp.entity_id != 0)
            return;

        if (campgrounds.length < 1) 
            return;

        return (
        <Table className="border">
            <TableHeader>
                <TableRow>
                  <TableHead>Sites</TableHead>
                  <TableHead className="w-[100px]">Name</TableHead>
                  <TableHead>Parent</TableHead>
                  <TableHead className="text-right">Location</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {campgrounds.map( (camp,idx) =>
                <TableRow key={idx}>
                    <TableCell>{camp.campsites_count}</TableCell>
                    {camp===campInfo.camp? 
                    <TableCell className="font-medium bg-blue-200">{camp.name}</TableCell>
                    :<TableCell className="font-medium underline cursor-pointer" onClick={()=>onClickSelectCampground(idx)}>{camp.name}</TableCell>
                    }
                    <TableCell>{camp.parent_name}</TableCell>
                    <TableCell className="text-right">{camp.city}, {camp.state_code}</TableCell>
                </TableRow>
                )
                }
            </TableBody>
        </Table>
        );
    }

    // generate date values for buttons
    const date = new Date();
    const currentMonth = date.getUTCMonth();
    const tabsTrigger : ReactElement[] = [];

    for (let step = 0; step < 6; step++) {
        date.setUTCMonth(currentMonth + step);
        const isoDate = date.toISOString().slice(0, 7) + '-01T00%3A00%3A00.000Z';
        const monthName = date.toUTCString().split(" ").at(2);

        tabsTrigger.push(<TabsTrigger key={isoDate} value={isoDate} onClick={()=>onClickSetDate(isoDate)}>{monthName}</TabsTrigger>)
    }

    function CampsitePanel() {
        if (campInfo.camp.entity_id == 0)
            return;

        return (
        <>
        <Tabs defaultValue={campInfo.availableDate} className="w-[400px] mt-2">
            <div>
                <label className="cursor-pointer mr-2" onClick={onClickBackToCampgrounds}>◀&nbsp;Back</label>
                <TabsList>
                    {...tabsTrigger}
                </TabsList>
            </div>
        </Tabs>

        <center>
            <label className="mx-auto font-bold">{campInfo.camp.name}</label>
        </center>

        {availableSites?.length > 0 &&
        <Table className="border p-4 mt-2">
            <TableHeader className="sticky top-0">
                <TableRow>
                  <TableHead>Site</TableHead>
                  <TableHead>Loop</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Available days</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {availableSites.map( (site,idx) =>
                <TableRow key={idx}>
                    <TableCell className="font-medium underline">
                        <a href={'https://www.recreation.gov/camping/campsites/'+site.campsite_id} target="_blank">{site.site}</a>
                    </TableCell>
                    <TableCell>{site.loop}</TableCell>
                    <TableCell>{site.campsite_type}</TableCell>
                    <TableCell>{site.daysSpan}</TableCell>
                </TableRow>
                )
                }
            </TableBody>
        </Table>
        }
        </>
        );
    }

    // main()
    return (
        <>
            <div className="flex items-center justify-center gap-2 mt-2">
                <SearchForm/>
            </div>

            <div className="m-2">
                <CampgroundPanel/>
                <CampsitePanel/>
            </div>
        </>
    )
}
